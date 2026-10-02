import { appendFile, mkdtemp, readFile, rm } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import ExcelJS from 'exceljs'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { AnalysisService } from '../src/main/services/analysisService'
import { ExportService } from '../src/main/services/exportService'
import { ProjectStore } from '../src/main/services/projectStore'
import { WorkbookService } from '../src/main/services/workbookService'
import { mockLayaNlp } from './laya-fixtures'

const { showSaveDialog } = vi.hoisted(() => ({ showSaveDialog: vi.fn() }))
vi.mock('electron/main', () => ({ default: { dialog: { showSaveDialog } } }))

const directories: string[] = []
const window = {} as Electron.BrowserWindow

async function setup() {
  const directory = await mkdtemp(join(tmpdir(), 'catalog-corrected-export-'))
  directories.push(directory)
  const source = join(directory, 'original.xlsx')
  const output = join(directory, 'fixed.csv')
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('Records')
  sheet.addRow(['ID', 'Name', 'Email', 'Notes'])
  sheet.addRow([1, 'Ána, "One"', 'a@example.test', 'first line\nsecond line'])
  sheet.addRow([2, 'Missing email', '', 'Exclude this row'])
  sheet.addRow([3, 'Unreviewed', 'b@example.test', 'Keep original'])
  await workbook.xlsx.writeFile(source)
  const projects = new ProjectStore(directory)
  const project = await projects.create({ name: 'CSV review' })
  const workbooks = new WorkbookService()
  const profile = await workbooks.inspectPath(source)
  const analysis = new AnalysisService(workbooks, projects, mockLayaNlp())
  const input = { projectId: project.id, sessionId: profile.sessionId, sheetName: 'Records', rulesText: 'Flag rows with a missing email.', disabledRuleIds: [], columnMappings: {} }
  const result = await analysis.run(input)
  showSaveDialog.mockResolvedValue({ canceled: false, filePath: output })
  return { source, output, analysis, input, result, service: new ExportService(analysis) }
}

afterEach(async () => {
  vi.resetAllMocks()
  for (const directory of directories.splice(0)) {
    expect(resolve(directory).startsWith(join(tmpdir(), 'catalog-corrected-export-'))).toBe(true)
    await rm(directory, { recursive: true, force: true })
  }
})

describe('corrected CSV download service', () => {
  it('writes the original dataset minus deleted rows, not a findings report, and never changes the workbook', async () => {
    const { source, output, service, result } = await setup()
    const original = await readFile(source)
    expect(result.findings[0]?.rowNumbers).toEqual([3])
    expect(await service.downloadCsv(window, { analysisId: result.id, deletedRowNumbers: [3] })).toBe(output)
    const exported = new ExcelJS.Workbook()
    const sheet = await exported.csv.readFile(output)
    expect([1, 2, 3, 4].map((column) => sheet.getRow(1).getCell(column).value)).toEqual(['ID', 'Name', 'Email', 'Notes'])
    expect(sheet.rowCount).toBe(3)
    expect(sheet.getRow(2).getCell(2).value).toBe('Ána, "One"')
    expect(sheet.getRow(2).getCell(4).value).toBe('first line\nsecond line')
    expect(sheet.getRow(3).getCell(1).value).toBe(3)
    expect(await readFile(source)).toEqual(original)
  })

  it('keeps all rows when none are marked Delete', async () => {
    const { output, service, result } = await setup()
    await service.downloadCsv(window, { analysisId: result.id, deletedRowNumbers: [] })
    const workbook = new ExcelJS.Workbook()
    expect((await workbook.csv.readFile(output)).rowCount).toBe(4)
  })

  it('does not write anything when the download is canceled', async () => {
    const { output, service, result } = await setup()
    showSaveDialog.mockResolvedValueOnce({ canceled: true })
    expect(await service.downloadCsv(window, { analysisId: result.id, deletedRowNumbers: [3] })).toBeNull()
    expect(existsSync(output)).toBe(false)
  })

  it('rejects deletion of rows that are not part of an active finding', async () => {
    const { output, service, result } = await setup()
    await expect(service.downloadCsv(window, { analysisId: result.id, deletedRowNumbers: [4] })).rejects.toThrow('Only rows from the active findings')
    expect(existsSync(output)).toBe(false)
  })

  it('rejects changed source data rather than exporting stale or mismatched rows', async () => {
    const { source, output, service, result } = await setup()
    await appendFile(source, 'changed')
    await expect(service.downloadCsv(window, { analysisId: result.id, deletedRowNumbers: [] })).rejects.toThrow('source workbook changed')
    expect(existsSync(output)).toBe(false)
  })

  it('does not export an analysis that became inactive while the save dialog was open', async () => {
    const { output, analysis, input, service, result } = await setup()
    showSaveDialog.mockImplementationOnce(async () => {
      await analysis.run(input)
      return { canceled: false, filePath: output }
    })
    await expect(service.downloadCsv(window, { analysisId: result.id, deletedRowNumbers: [] })).rejects.toThrow('no longer active')
    expect(existsSync(output)).toBe(false)
  })

  it('refuses an .xlsx destination even when the source workbook is selected', async () => {
    const { source, service, result } = await setup()
    const original = await readFile(source)
    showSaveDialog.mockResolvedValueOnce({ canceled: false, filePath: source })
    await expect(service.downloadCsv(window, { analysisId: result.id, deletedRowNumbers: [] })).rejects.toThrow('.csv file')
    expect(await readFile(source)).toEqual(original)
  })
})

describe('reviewed Excel download service', () => {
  it('exports accepted findings with their actions and red cells without touching the original', async () => {
    const { source, output, service, result } = await setup()
    const destination = output.replace('.csv', '.xlsx')
    const original = await readFile(source)
    showSaveDialog.mockResolvedValueOnce({ canceled: false, filePath: destination })
    expect(await service.downloadWorkbook(window, { analysisId: result.id, acceptedRowNumbers: [3] })).toBe(destination)
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.readFile(destination)
    const sheet = workbook.worksheets[0]!
    expect(sheet.rowCount).toBe(4)
    expect(sheet.getRow(3).getCell(3).fill).toMatchObject({ type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } })
    expect(sheet.getRow(3).getCell(5).value).toBeTruthy()
    expect(await readFile(source)).toEqual(original)
  })

  it('leaves unreviewed findings out but keeps clean rows', async () => {
    const { output, service, result } = await setup()
    const destination = output.replace('.csv', '.xlsx')
    showSaveDialog.mockResolvedValueOnce({ canceled: false, filePath: destination })
    await service.downloadWorkbook(window, { analysisId: result.id, acceptedRowNumbers: [] })
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.readFile(destination)
    expect(workbook.worksheets[0]?.rowCount).toBe(3)
  })

  it('refuses source overwrites and foreign or repeated acceptance decisions', async () => {
    const { source, output, service, result } = await setup()
    const original = await readFile(source)
    showSaveDialog.mockResolvedValueOnce({ canceled: false, filePath: source })
    await expect(service.downloadWorkbook(window, { analysisId: result.id, acceptedRowNumbers: [3] })).rejects.toThrow('cannot be overwritten')
    showSaveDialog.mockResolvedValue({ canceled: false, filePath: output.replace('.csv', '.xlsx') })
    await expect(service.downloadWorkbook(window, { analysisId: result.id, acceptedRowNumbers: [4] })).rejects.toThrow('active findings')
    await expect(service.downloadWorkbook(window, { analysisId: result.id, acceptedRowNumbers: [3, 3] })).rejects.toThrow('distinct')
    expect(await readFile(source)).toEqual(original)
  })

  it('cancels cleanly and rejects a stale analysis after the save dialog', async () => {
    const { output, service, analysis, input, result } = await setup()
    const destination = output.replace('.csv', '.xlsx')
    showSaveDialog.mockResolvedValueOnce({ canceled: true })
    expect(await service.downloadWorkbook(window, { analysisId: result.id, acceptedRowNumbers: [3] })).toBeNull()
    showSaveDialog.mockImplementationOnce(async () => {
      await analysis.run(input)
      return { canceled: false, filePath: destination }
    })
    await expect(service.downloadWorkbook(window, { analysisId: result.id, acceptedRowNumbers: [3] })).rejects.toThrow('no longer active')
    expect(existsSync(destination)).toBe(false)
  })
})
