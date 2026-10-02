import type { CompilationResult, ProjectRecord } from '@core/model/domain'

export interface RuleValidationResult {
  compilation: CompilationResult
  project: ProjectRecord | null
}

export interface RuleLabel {
  text: 'Check Duplicate' | 'Check Missing' | 'Invalid'
  tone: 'duplicate' | 'danger'
}
