import { stat } from 'node:fs/promises'
import { basename, extname, isAbsolute, resolve } from 'node:path'

import electronMain from 'electron/main'
import ExcelJS from 'exceljs'

import type { CellValue, DatasetRow, WorkbookProfile, WorksheetProfile } from '@core/model/domain'
import { createDatasetColumns, detectHeaderRow } from '@core/dataset/headerDetection'
import { profileWorksheet } from '@core/dataset/profiling'
import { isMissingValue, stringifyCellValue } from '@core/normalization/normalizers'

const { dialog } = electronMain

interface ParsedWorksheet {
  profile: WorksheetProfile
  rows: DatasetRow[]
}

interface WorkbookSession {
  id: string
  filePath: string
  fileName: string
  fileSize: number
  modifiedAt: string
  workbook: ExcelJS.Workbook
  parsedSheets: Map<string, ParsedWorksheet>
}

function primitiveCellValue(value: unknown): CellValue {
  if (value === null || value === undefined) return null
  if (value instanceof Date) return value
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value
  return String(value)
}

function readCell(cell: ExcelJS.Cell): CellValue {
  const value = cell.value

  if (value === null || value === undefined) return null
  if (value instanceof Date || typeof value === 'string' || typeof value === 'boolean') return value
  if (typeof value === 'number') {
    const displayed = cell.text.trim()
    if (/^0\d+$/u.test(displayed) && displayed.length > String(value).length) return displayed
    return value
  }
  if (typeof value === 'object') {
    if ('result' in value) return primitiveCellValue(value.result)
    if ('richText' in value && Array.isArray(value.richText)) {
      return value.richText.map((part) => part.text).join('')
    }
    if ('text' in value && typeof value.text === 'string') return value.text
    if ('error' in value && typeof value.error === 'string') return value.error
  }
  return cell.text || String(value)
}

function trimTrailingEmpty(values: CellValue[]): CellValue[] {
  let lastIndex = values.length - 1
  while (lastIndex >= 0 && isMissingValue(values[lastIndex] ?? null)) lastIndex -= 1
  return values.slice(0, lastIndex + 1)
}

export class WorkbookService {
  private readonly sessions = new Map<string, WorkbookSession>()

  async chooseWorkbook(window: Electron.BrowserWindow): Promise<WorkbookProfile | null> {
    const selection = await dialog.showOpenDialog(window, {
      title: 'Choose an Excel workbook',
      properties: ['openFile'],
      filters: [
        { name: 'Excel workbooks', extensions: ['xlsx'] },
        { name: 'All files', extensions: ['*'] }
      ]
    })
    if (selection.canceled || !selection.filePaths[0]) return null
    return this.inspectPath(selection.filePaths[0])
  }

  async inspectPath(inputPath: string, selectedSheetName?: string): Promise<WorkbookProfile> {
    const filePath = resolve(inputPath)
    if (!isAbsolute(filePath)) throw new Error('The workbook path must be absolute.')
    const extension = extname(filePath).toLocaleLowerCase('en-US')
    if (extension === '.xls') {
      throw new Error('Legacy .xls files are not opened because the available parser is not considered safe enough. Save the workbook as .xlsx and try again.')
    }
    if (extension !== '.xlsx') throw new Error('Unsupported file format. Choose an .xlsx workbook.')

    const fileStats = await stat(filePath)
    if (!fileStats.isFile()) throw new Error('The selected path is not a file.')
    if (fileStats.size > 300 * 1024 * 1024) throw new Error('The workbook is larger than the 300 MB safety limit.')

    const workbook = new ExcelJS.Workbook()
    try {
      await workbook.xlsx.readFile(filePath, {
        ignoreNodes: ['dataValidations', 'extLst', 'picture']
      })
    } catch (error) {
      throw new Error(`Could not read the workbook. It may be corrupted or password protected. ${error instanceof Error ? error.message : ''}`.trim())
    }
    if (workbook.worksheets.length === 0) throw new Error('The workbook does not contain any worksheets.')

    for (const worksheet of workbook.worksheets) {
      if (worksheet.actualRowCount > 1_100_000 || worksheet.actualColumnCount > 16_500) {
        throw new Error(`Worksheet “${worksheet.name}” exceeds supported Excel dimensions.`)
      }
    }

    const session: WorkbookSession = {
      id: crypto.randomUUID(),
      filePath,
      fileName: basename(filePath),
      fileSize: fileStats.size,
      modifiedAt: fileStats.mtime.toISOString(),
      workbook,
      parsedSheets: new Map()
    }
    this.sessions.set(session.id, session)
    this.pruneSessions(session.id)
    return this.buildProfile(session, selectedSheetName ?? workbook.worksheets[0]?.name ?? '')
  }

  getSourcePath(sessionId: string): string {
    return this.requireSession(sessionId).filePath
  }

  async getWorksheetData(sessionId: string, sheetName: string): Promise<ParsedWorksheet> {
    const session = this.requireSession(sessionId)
    await this.assertSourceUnchanged(session)
    return this.parseWorksheet(session, sheetName)
  }

  private async buildProfile(session: WorkbookSession, sheetName: string): Promise<WorkbookProfile> {
    const selectedSheet = this.parseWorksheet(session, sheetName).profile
    return {
      sessionId: session.id,
      fileName: session.fileName,
      fileSize: session.fileSize,
      modifiedAt: session.modifiedAt,
      sheets: session.workbook.worksheets.map((worksheet) => ({
        name: worksheet.name,
        estimatedRowCount: Math.max(0, worksheet.actualRowCount - 1),
        estimatedColumnCount: worksheet.actualColumnCount
      })),
      selectedSheet
    }
  }

  private parseWorksheet(session: WorkbookSession, sheetName: string): ParsedWorksheet {
    const cached = session.parsedSheets.get(sheetName)
    if (cached) return cached
    const worksheet = session.workbook.getWorksheet(sheetName)
    if (!worksheet) throw new Error(`Worksheet “${sheetName}” was not found.`)

    const maxColumns = Math.max(worksheet.actualColumnCount, worksheet.columnCount)
    const scanRows = Math.min(Math.max(worksheet.actualRowCount, 1), 20)
    const matrix: CellValue[][] = []
    for (let rowNumber = 1; rowNumber <= scanRows; rowNumber += 1) {
      const values: CellValue[] = []
      for (let columnNumber = 1; columnNumber <= maxColumns; columnNumber += 1) {
        values.push(readCell(worksheet.getRow(rowNumber).getCell(columnNumber)))
      }
      matrix.push(trimTrailingEmpty(values))
    }

    const headerRow = detectHeaderRow(matrix)
    const headerValues: CellValue[] = []
    for (let columnNumber = 1; columnNumber <= maxColumns; columnNumber += 1) {
      headerValues.push(readCell(worksheet.getRow(headerRow).getCell(columnNumber)))
    }
    const effectiveHeaders = trimTrailingEmpty(headerValues)
    if (effectiveHeaders.length === 0) throw new Error(`Worksheet “${sheetName}” does not contain a recognizable header row.`)
    const { columns, warnings } = createDatasetColumns(effectiveHeaders)
    const rows: DatasetRow[] = []

    for (let rowNumber = headerRow + 1; rowNumber <= worksheet.actualRowCount; rowNumber += 1) {
      const values: Record<string, CellValue> = {}
      let hasValue = false
      for (const column of columns) {
        const value = readCell(worksheet.getRow(rowNumber).getCell(column.index + 1))
        values[column.key] = value
        if (!isMissingValue(value)) hasValue = true
      }
      if (hasValue) rows.push({ rowNumber, values })
    }

    if (rows.length === 0 && effectiveHeaders.every((value) => isMissingValue(value))) {
      throw new Error(`Worksheet “${sheetName}” is empty.`)
    }

    const profile = profileWorksheet(sheetName, headerRow, columns, rows, warnings)
    const parsed = { profile, rows }
    session.parsedSheets.set(sheetName, parsed)
    return parsed
  }

  private requireSession(sessionId: string): WorkbookSession {
    const session = this.sessions.get(sessionId)
    if (!session) throw new Error('The workbook session expired. Reopen the workbook and try again.')
    return session
  }

  private async assertSourceUnchanged(session: WorkbookSession): Promise<void> {
    const currentStats = await stat(session.filePath)
    if (currentStats.size !== session.fileSize || currentStats.mtime.toISOString() !== session.modifiedAt) {
      this.sessions.delete(session.id)
      throw new Error('The source workbook changed after it was opened. Reopen it to refresh the profile and caches.')
    }
  }

  private pruneSessions(activeSessionId: string): void {
    if (this.sessions.size <= 3) return
    for (const sessionId of this.sessions.keys()) {
      if (sessionId !== activeSessionId) {
        this.sessions.delete(sessionId)
        if (this.sessions.size <= 3) break
      }
    }
  }
}
