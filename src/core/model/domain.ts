import type { BusinessCheck, BusinessExecutionPlan, RuleConfiguration, RulePriority } from './businessRules'

export type CellValue = string | number | boolean | Date | null

export type DataType = 'text' | 'number' | 'date' | 'boolean' | 'mixed' | 'empty'

export type SemanticType =
  | 'name'
  | 'phone'
  | 'email'
  | 'cpf'
  | 'cnpj'
  | 'identifier'
  | 'date'
  | 'number'
  | 'text'
  | 'unknown'

export type RuleCategory =
  | 'duplicate'
  | 'normalization'
  | 'validation'
  | 'uniqueness'
  | 'consistency'
  | 'missing'
  | 'similarity'

export type FindingType =
  | 'DUPLICATE'
  | 'POSSIBLE_DUPLICATE'
  | 'INVALID'
  | 'MISSING'
  | 'INCONSISTENT'
  | 'UNIQUENESS_VIOLATION'
  | 'NORMALIZATION_CONFLICT'
  | 'RULE_VIOLATION'

export type Severity = 'info' | 'warning' | 'error' | 'critical'
export type ImpactLevel = 'small' | 'medium' | 'large'
export type FindingConfidence = 'LOW' | 'MEDIUM' | 'HIGH'
export type InterpretationStatus = 'valid' | 'needs_mapping' | 'needs_configuration' | 'unsupported'
export type FieldBindingStatus = 'resolved' | 'ambiguous' | 'missing'

export type NormalizationOperation =
  | 'unicode'
  | 'trim'
  | 'lowercase'
  | 'uppercase'
  | 'remove_accents'
  | 'normalize_whitespace'
  | 'remove_whitespace'
  | 'remove_punctuation'
  | 'digits_only'
  | 'phone_br'
  | 'email'
  | 'identifier'

export type SimilarityAlgorithm = 'jaro_winkler' | 'levenshtein' | 'token_jaccard'

export type ValidatorKind =
  | 'email'
  | 'cpf'
  | 'cnpj'
  | 'phone_br'
  | 'date'
  | 'number'
  | 'required'

export interface SourceRule {
  id: string
  sourceText: string
  enabled: boolean
  order: number
}

export interface DatasetColumn {
  key: string
  header: string
  index: number
}

export interface DatasetRow {
  rowNumber: number
  values: Record<string, CellValue>
}

export interface SemanticCandidate {
  semanticType: SemanticType
  score: number
  reasons: string[]
}

export interface ColumnProfile extends DatasetColumn {
  dataType: DataType
  semanticType: SemanticType
  semanticConfidence: number
  semanticCandidates: SemanticCandidate[]
  nonEmptyCount: number
  missingCount: number
  missingRate: number
  uniqueCount: number
  uniquenessRatio: number
  examples: string[]
  formatVariants: string[]
}

export interface WorksheetProfile {
  name: string
  rowCount: number
  columnCount: number
  headerRow: number
  columns: ColumnProfile[]
  warnings: string[]
}

export interface WorkbookProfile {
  sessionId: string
  fileName: string
  fileSize: number
  modifiedAt: string
  sheets: Array<{
    name: string
    estimatedRowCount: number
    estimatedColumnCount: number
  }>
  selectedSheet: WorksheetProfile
}

export interface FieldCandidate {
  columnKey: string
  columnHeader: string
  score: number
  reason: string
}

export interface FieldBinding {
  token: string
  role: 'match' | 'key' | 'dependent' | 'target'
  semanticType: SemanticType
  status: FieldBindingStatus
  columnKey?: string
  columnHeader?: string
  candidates: FieldCandidate[]
}

export interface RuleInterpretation {
  id: string
  sourceText: string
  category: RuleCategory
  status: InterpretationStatus
  entity: string
  purpose: string
  title?: string
  priority?: RulePriority
  actionItem?: string
  logicSummary?: string
  businessCheck?: BusinessCheck
  reference?: never
  fields: FieldBinding[]
  normalizations: NormalizationOperation[]
  logic: 'and' | 'or'
  comparison: 'equals' | 'similarity' | 'validate' | 'unique' | 'required' | 'consistent'
  similarity?: {
    algorithm: SimilarityAlgorithm
    threshold: number
  }
  validator?: ValidatorKind
  severity: Severity
  interpretationConfidence: number
  explanation: string
  warnings: string[]
  aiValidation?: {
    provider: 'laya'
    model: string
    decision: 'approved' | 'needs_review'
    confidence: number
    method?: 'operation_choice' | 'intent_entailment'
  }
}

export interface ResolvedField {
  columnKey: string
  columnHeader: string
  semanticType: SemanticType
}

export interface CompiledMatcher {
  field: ResolvedField
  normalizations: NormalizationOperation[]
  comparison: 'equals' | 'similarity'
  similarity?: {
    algorithm: SimilarityAlgorithm
    threshold: number
  }
}

export type ExecutionPlan =
  | BusinessExecutionPlan
  | {
      kind: 'duplicate'
      matchers: CompiledMatcher[]
      logic: 'and' | 'or'
    }
  | {
      kind: 'validation'
      field: ResolvedField
      validator: ValidatorKind
      normalizations: NormalizationOperation[]
    }
  | {
      kind: 'missing'
      field: ResolvedField
    }
  | {
      kind: 'uniqueness'
      field: ResolvedField
      normalizations: NormalizationOperation[]
    }
  | {
      kind: 'consistency'
      keyField: ResolvedField
      dependentField: ResolvedField
      keyNormalizations: NormalizationOperation[]
      dependentNormalizations: NormalizationOperation[]
    }

export interface CompiledRule {
  id: string
  sourceText: string
  category: RuleCategory
  severity: Severity
  interpretation: RuleInterpretation
  plan: ExecutionPlan | null
}

export interface CompilationIssue {
  ruleId: string
  message: string
  code: 'AMBIGUOUS_FIELD' | 'MISSING_FIELD' | 'UNSUPPORTED_RULE' | 'INVALID_RULE'
  candidates?: FieldCandidate[]
}

export interface CompilationResult {
  provider?: 'laya'
  interpretations: RuleInterpretation[]
  compiledRules: CompiledRule[]
  normalizationPolicies: Record<string, NormalizationOperation[]>
  issues: CompilationIssue[]
  canRun: boolean
}

export interface FindingEvidence {
  rowNumber: number
  columnKey: string
  columnHeader: string
  originalValue: CellValue
  normalizedValue: string
  comparator: string
  score?: number
}

export interface Finding {
  scope?: 'worksheet'
  id: string
  type: FindingType
  severity: Severity
  impactLevel?: ImpactLevel
  confidence: FindingConfidence
  ruleId: string
  ruleText: string
  sheet: string
  rowNumbers: number[]
  fields: string[]
  evidence: FindingEvidence[]
  explanation: string
  suggestedAction: string
  priority?: RulePriority
  createdAt: string
}

export interface FindingSourceColumn extends DatasetColumn {
  affected: boolean
}

export interface FindingReviewGroup {
  id: string
  sheet: string
  types: FindingType[]
  rowNumbers: number[]
  fields: string[]
  evidence: FindingEvidence[]
  findings: Finding[]
  impactLevel: ImpactLevel
  explanation: string
}

export interface FindingSourceRows {
  columns: FindingSourceColumn[]
  rows: DatasetRow[]
  offset: number
  totalRows: number
}

export interface AnalysisSummary {
  totalFindings: number
  duplicateGroups: number
  possibleDuplicateGroups: number
  invalidValues: number
  missingValues: number
  consistencyViolations: number
  uniquenessViolations: number
  ruleViolations: number
}

export interface AnalysisResult {
  id: string
  projectId: string
  sessionId: string
  sheetName: string
  startedAt: string
  completedAt: string
  durationMs: number
  rowsAnalyzed: number
  rulesExecuted: number
  findings: Finding[]
  summary: AnalysisSummary
  warnings: string[]
  compilation: CompilationResult
}

export interface AnalysisHistoryItem {
  id: string
  sheetName: string
  completedAt: string
  rowsAnalyzed: number
  summary: AnalysisSummary
}

export interface ProjectRecord {
  id: string
  name: string
  description: string
  createdAt: string
  updatedAt: string
  rulesText: string
  disabledRuleIds: string[]
  ruleImpacts: Record<string, ImpactLevel>
  ruleConfigurations?: Record<string, RuleConfiguration>
  columnMappings: Record<string, string>
  sourceFilePath?: string
  selectedSheet?: string
  persistAnalysisResults: boolean
  analysisHistory: AnalysisHistoryItem[]
}

export interface CreateProjectInput {
  name: string
  description?: string
}

export interface UpdateProjectDetailsInput {
  id: string
  name: string
  description: string
}

export type RowDecision = 'accept' | 'delete'

export interface AnalysisRowReview {
  analysisId: string
  decisions: Record<number, RowDecision>
}

export interface CorrectedCsvRequest {
  analysisId: string
  deletedRowNumbers: number[]
}

export interface ReviewedWorkbookRequest {
  analysisId: string
  acceptedRowNumbers: number[]
}

export interface ProjectDataset {
  project: ProjectRecord
  workbook: WorkbookProfile
}

export interface UpdateProjectInput {
  id: string
  name: string
  description: string
  rulesText: string
  disabledRuleIds: string[]
  ruleImpacts?: Record<string, ImpactLevel>
  ruleConfigurations?: Record<string, RuleConfiguration>
  columnMappings: Record<string, string>
  sourceFilePath?: string
  selectedSheet?: string
  persistAnalysisResults: boolean
}

export type NlpProviderKind = 'deterministic' | 'jev' | 'laya' | 'custom'

export interface NlpProviderSettings {
  kind: NlpProviderKind
  endpoint: string
  model: string
  apiKeyConfigured: boolean
  sendColumnExamples: boolean
}

export interface AppSettings {
  provider: NlpProviderSettings
  copilot: {
    endpoint: string
    model: string
    apiKeyConfigured: boolean
    sendFindingEvidence: boolean
  }
  defaultPersistAnalysisResults: boolean
  theme: 'light'
}

export interface RuleInterpretationRequest {
  rules: SourceRule[]
  profile?: WorksheetProfile
  columnMappings: Record<string, string>
  ruleConfigurations?: Record<string, RuleConfiguration>
}

export interface AnalysisRequest {
  projectId: string
  sessionId: string
  sheetName: string
  rulesText: string
  disabledRuleIds: string[]
  ruleImpacts?: Record<string, ImpactLevel>
  ruleConfigurations?: Record<string, RuleConfiguration>
  columnMappings: Record<string, string>
}

export interface InterpretationPreviewRequest {
  sessionId?: string
  sheetName?: string
  rulesText: string
  disabledRuleIds: string[]
  columnMappings: Record<string, string>
  ruleConfigurations?: Record<string, RuleConfiguration>
}

export interface UpdateSettingsInput {
  provider: Omit<NlpProviderSettings, 'apiKeyConfigured'>
  apiKey?: string
  clearApiKey?: boolean
  copilot: Omit<AppSettings['copilot'], 'apiKeyConfigured'>
  copilotApiKey?: string
  clearCopilotApiKey?: boolean
  defaultPersistAnalysisResults: boolean
  theme: AppSettings['theme']
}
