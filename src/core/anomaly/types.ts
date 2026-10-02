import type { CellValue } from '../model/domain'
import { isMissingValue } from '../normalization/normalizers'

export type AnomalyCategory =
  | 'NUMERIC_OUTLIER'
  | 'FORMAT_DEVIATION'
  | 'DATA_TYPE_INCONSISTENCY'
  | 'ATYPICAL_MISSING'
  | 'SEMANTIC_PATTERN_BREAK'

export type AnomalySeverity = 'info' | 'warning' | 'error' | 'critical'

export interface AnomalyBaseline {
  dominantValue?: string
  dominantPattern?: string
  dominantCoverage?: number
  median?: number
  mad?: number
  expectedRange?: [number, number]
  correlatedColumn?: string
  conditionValue?: string
  completenessRateUnderCondition?: number
}

export interface AnomalyActionSuggestion {
  type: 'auto_format' | 'flag_or_scale' | 'request_data' | 'create_rule'
  label: string
  replacementCandidate?: CellValue
  suggestedRuleText?: string
}

export interface DetectedAnomaly {
  id: string
  category: AnomalyCategory
  method: 'statistical_mad' | 'statistical_iqr' | 'mask_clustering' | 'type_voting' | 'null_correlation' | 'laya_semantic'
  severity: AnomalySeverity
  confidence: 'LOW' | 'MEDIUM' | 'HIGH'
  score: number // 0.0 to 1.0
  columnKey: string
  columnHeader: string
  rowNumbers: number[]
  value: CellValue
  baseline?: AnomalyBaseline
  explanation: string
  actionableSuggestion?: AnomalyActionSuggestion
}

export interface AnomalyScanSummary {
  totalAnomalies: number
  byCategory: Record<AnomalyCategory, number>
  bySeverity: Record<AnomalySeverity, number>
  scannedRows: number
  scannedColumns: number
}

export type GovernancePillar = 'essential_field' | 'primary_key' | 'type_validation' | 'status_dependency'

export interface GovernanceRuleDraft {
  pillar: GovernancePillar
  title: string
  ruleText: string
  reason: string
  columnHeader: string
  category: AnomalyCategory
}

export interface AnomalyScanResult {
  sheetName: string
  summary: AnomalyScanSummary
  anomalies: DetectedAnomaly[]
  draftRules: GovernanceRuleDraft[]
}
