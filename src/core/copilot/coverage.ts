import type { CompilationResult, WorksheetProfile } from '../model/domain'

export interface CoverageCandidate {
  id: string
  kind: 'unresolved_rule' | 'unruled_missing' | 'format_variants'
  label: string
  evidence: string
}

export function selectCoverageSuggestion(candidates: CoverageCandidate[], choice: unknown, confidence: unknown, truncated = false): string | null {
  return !truncated && typeof choice === 'string' && typeof confidence === 'number' &&
    Number.isFinite(confidence) && confidence >= 0.8 && confidence <= 1 &&
    candidates.some((candidate) => candidate.id === choice) ? choice : null
}

export function coverageCandidates(profile: WorksheetProfile, compilation: CompilationResult): CoverageCandidate[] {
  const referenced = new Set(compilation.interpretations.flatMap((rule) =>
    rule.fields.flatMap((field) => field.status === 'resolved' && field.columnKey ? [field.columnKey] : [])
  ))
  const unresolved: CoverageCandidate[] = compilation.issues.slice(0, 3).map((issue, index) => ({
    id: `rule-${index}`,
    kind: 'unresolved_rule',
    label: `Review rule ${issue.ruleId}`,
    evidence: `This rule was not fully executable (${issue.code.toLowerCase().replaceAll('_', ' ')}). Confirm its interpretation or mapping.`
  }))
  const gaps: CoverageCandidate[] = profile.columns.filter((column) => !referenced.has(column.key))
    .sort((a, b) => b.missingRate - a.missingRate)
    .filter((column) => column.nonEmptyCount > 0 && column.missingRate >= 0.15)
    .slice(0, 3).map((column) => ({
      id: `missing-${column.key}`,
      kind: 'unruled_missing',
      label: `Review coverage of ${column.header}`,
      evidence: `${Math.round(column.missingRate * 100)}% empty in a column not referenced by an interpreted rule. Missing data may be allowed; confirm before adding a rule.`
    }))
  const formats: CoverageCandidate[] = profile.columns.filter((column) =>
    !referenced.has(column.key) && column.formatVariants.length >= 4
  ).slice(0, 2).map((column) => ({
    id: `format-${column.key}`,
    kind: 'format_variants',
    label: `Review formats in ${column.header}`,
    evidence: `${column.formatVariants.length} observed formats without a rule referencing this column. Variants are not necessarily errors.`
  }))
  return [...unresolved, ...gaps, ...formats].slice(0, 6)
}
