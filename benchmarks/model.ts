import type { RuleConfiguration } from '../src/core/model/businessRules'
import type { CellValue, RuleCategory, RuleInterpretation, WorksheetProfile } from '../src/core/model/domain'
import type { RulePriority } from '../src/core/model/businessRules'

export interface RuleBenchmarkCase {
  id: string
  family: string
  sourceText: string
  records: Record<string, CellValue>[]
  profile?: WorksheetProfile
  columnMappings?: Record<string, string>
  configuration?: RuleConfiguration
  expected: {
    status: RuleInterpretation['status']
    category?: RuleCategory
    fields?: string[]
    priority: RulePriority
    actionItem: string
    flaggedRows?: number[]
  }
}

export interface RuleBenchmarkResult {
  id: string
  family: string
  sourceText: string
  expected: RuleBenchmarkCase['expected']
  candidateStatus?: RuleInterpretation['status']
  status?: RuleInterpretation['status']
  category?: RuleCategory
  mappedFields?: string[]
  priority?: RulePriority
  actionItem?: string
  aiValidation?: RuleInterpretation['aiValidation']
  positiveProbability?: number
  canRun: boolean
  flaggedRows?: number[]
  warnings: string[]
  latencyMs: number
  passed: boolean
  failures: string[]
}
