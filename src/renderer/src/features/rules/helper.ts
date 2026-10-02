import type { CompilationIssue, RuleInterpretation } from '@core/model/domain'
import type { RuleConfiguration } from '@core/model/businessRules'
import type { ImpactLevel } from '@core/model/domain'
import { impactPriority } from '@core/rules/metadata'

import { RULE_LABELS } from './constants'
import type { RuleLabel } from './models'

export function ruleLabel(interpretation: RuleInterpretation, issues: CompilationIssue[]): RuleLabel | null {
  if (interpretation.status !== 'valid' || issues.some((issue) => issue.ruleId === interpretation.id)) {
    return { text: RULE_LABELS.invalid, tone: 'danger' }
  }
  if (interpretation.category === 'duplicate' || interpretation.category === 'similarity' || interpretation.category === 'uniqueness') {
    return { text: RULE_LABELS.duplicate, tone: 'duplicate' }
  }
  if (interpretation.category === 'missing') return { text: RULE_LABELS.missing, tone: 'danger' }
  return null
}

export function ruleMessages(interpretation: RuleInterpretation, issues: CompilationIssue[]): string[] {
  return [...new Set([
    ...interpretation.warnings,
    ...issues.filter((issue) => issue.ruleId === interpretation.id).map((issue) => issue.message)
  ])]
}

export function effectiveRulePriority(interpretation: RuleInterpretation, configuration?: RuleConfiguration, impact?: ImpactLevel) {
  return configuration?.priority ?? (impact ? impactPriority(impact) : interpretation.priority ?? 'medium')
}

export function percentValue(value: string): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.min(1, Math.max(0, parsed / 100)) : 0
}

export function equalSimilarityWeights(fields: string[]): Record<string, number> {
  return Object.fromEntries(fields.map((field) => [field, 1 / fields.length]))
}
export function parseConditionValues(value: string): string[] {
  return [...new Set(value.split(/[,;\n]/u).map((entry) => entry.trim()).filter(Boolean))]
}
