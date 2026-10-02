import type { FindingConfidence, FindingSourceRows, FindingType, Severity } from '@core/model/domain'
import type { RowActionItem } from '@core/findings/rowActions'

export interface FindingFilters {
  search: string
  type: FindingType | 'all'
  severity: Severity | 'all'
  confidence: FindingConfidence | 'all'
}

export interface AnalysisReadinessCheck {
  label: string
  ready: boolean
  detail: string
  path: string
}

export interface SourceRowView {
  rowNumber: number
  actions: RowActionItem[]
  cells: Array<{
    columnKey: string
    original: string
    normalized: string | null
    affected: boolean
  }>
}

export type SourceRowsState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'loaded'; data: FindingSourceRows }
