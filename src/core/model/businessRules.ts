import type { ResolvedField } from './domain'

export type RulePriority = 'low' | 'low_medium' | 'medium' | 'medium_high' | 'high'

export interface RuleConfiguration {
  priority?: RulePriority
  actionItem?: string
  conditionValues?: Record<string, string[]>
  reference?: { sheetName: string; columnMappings: Record<string, string> }
  similarity?: { threshold: number; weights: Record<string, number> }
}

export interface RuleCondition {
  logic: 'and' | 'or'
  clauses: Array<{ field: string; values: string[] }>
}

export type ValuePredicate =
  | { operator: 'contains' | 'starts_with' | 'ends_with'; value: string; forbidden: boolean; caseSensitive: boolean }
  | { operator: 'one_of'; values: string[]; caseSensitive: boolean }
  | { operator: 'number_range'; minimum: number; maximum: number }

export type DatasetFormat = 'email' | 'zip' | 'zip4' | 'zip_or_zip4' | 'us_state'

export type BusinessCheck =
  | { kind: 'columns_exist'; targets: string[] }
  | { kind: 'required'; targets: string[]; match: 'all' | 'any'; when?: RuleCondition; configurableScope?: boolean }
  | { kind: 'value_check'; field: string; predicate: ValuePredicate; when?: RuleCondition }
  | { kind: 'format'; field: string; format: DatasetFormat; when?: RuleCondition }
  | { kind: 'duplicate_fields'; targets: string[]; normalized: boolean }
  | { kind: 'same_fields'; targets: string[] }
  | { kind: 'unique_any'; targets: string[] }
  | { kind: 'weighted_duplicate'; exactFields: string[]; weightedFields: string[]; threshold?: number; weights?: Record<string, number> }

export interface BusinessExecutionPlan {
  kind: 'business'
  check: BusinessCheck
  fields: Record<string, ResolvedField>
}

export interface RuleInterpretationContext {
  ruleConfigurations?: Record<string, RuleConfiguration>
}
