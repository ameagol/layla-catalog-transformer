import type { FindingSourceRows } from '@core/model/domain'

export const findingsService = {
  getSourceRows: (analysisId: string, findingId: string, offset: number): Promise<FindingSourceRows> =>
    window.catalogTransformer.getFindingRows(analysisId, findingId, offset),
  downloadCsv: (analysisId: string, deletedRowNumbers: number[]): Promise<string | null> =>
    window.catalogTransformer.downloadCorrectedCsv(analysisId, deletedRowNumbers),
  downloadWorkbook: (analysisId: string, acceptedRowNumbers: number[]): Promise<string | null> =>
    window.catalogTransformer.downloadReviewedWorkbook(analysisId, acceptedRowNumbers)
}
