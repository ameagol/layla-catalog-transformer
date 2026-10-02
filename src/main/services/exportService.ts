import { extname, resolve } from 'node:path'

import electronMain from 'electron/main'

import type { CorrectedCsvRequest, ReviewedWorkbookRequest } from '@core/model/domain'
import { correctedDatasetCsv } from '@core/export/csv'

import { AnalysisService } from './analysisService'
import { writeBufferAtomic, writeTextAtomic } from './fileStore'
import { reviewedDatasetWorkbook } from './reviewedWorkbook'

const { dialog } = electronMain

export class ExportService {
  constructor(private readonly analysis: AnalysisService) {}

  async downloadWorkbook(window: Electron.BrowserWindow, input: ReviewedWorkbookRequest): Promise<string | null> {
    const result = this.analysis.getActiveResult(input.analysisId)
    const selection = await dialog.showSaveDialog(window, {
      title: 'Download accepted rows with action items',
      defaultPath: `catalog-transformer-reviewed-${result.completedAt.slice(0, 10)}.xlsx`,
      filters: [{ name: 'Excel workbook with highlighted errors', extensions: ['xlsx'] }]
    })
    if (selection.canceled || !selection.filePath) return null
    const filePath = resolve(selection.filePath)
    if (extname(filePath).toLowerCase() !== '.xlsx') throw new Error('Save as .xlsx to preserve red error cells and row action items.')
    const dataset = await this.analysis.getDatasetForReviewedExport(input.analysisId, input.acceptedRowNumbers)
    if (filePath.toLowerCase() === resolve(dataset.sourceFilePath).toLowerCase()) throw new Error('Choose a different file. The source workbook cannot be overwritten.')
    const workbook = reviewedDatasetWorkbook(dataset.profile.columns, dataset.rows, result.findings, input.acceptedRowNumbers, result.warnings)
    const content = await workbook.xlsx.writeBuffer()
    await this.analysis.getDatasetForReviewedExport(input.analysisId, input.acceptedRowNumbers)
    await writeBufferAtomic(filePath, Buffer.from(content))
    return filePath
  }

  async downloadCsv(window: Electron.BrowserWindow, input: CorrectedCsvRequest): Promise<string | null> {
    const result = this.analysis.getActiveResult(input.analysisId)
    const selection = await dialog.showSaveDialog(window, {
      title: 'Download corrected dataset',
      defaultPath: `catalog-transformer-fixed-${result.completedAt.slice(0, 10)}.csv`,
      filters: [{ name: 'Comma-separated values', extensions: ['csv'] }]
    })
    if (selection.canceled || !selection.filePath) return null
    const filePath = resolve(selection.filePath)
    if (extname(filePath).toLowerCase() !== '.csv') {
      throw new Error('Save the corrected dataset as a .csv file. Your source workbook will not be overwritten.')
    }
    const dataset = await this.analysis.getDatasetForExport(input.analysisId, input.deletedRowNumbers)
    if (filePath.toLowerCase() === resolve(dataset.sourceFilePath).toLowerCase()) {
      throw new Error('Choose a different file. The source workbook cannot be overwritten.')
    }
    await writeTextAtomic(filePath, correctedDatasetCsv(dataset.profile.columns, dataset.rows, input.deletedRowNumbers))
    return filePath
  }
}
