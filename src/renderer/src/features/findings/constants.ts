import type { FindingType, ImpactLevel } from '@core/model/domain'

export const FINDINGS_COPY = {
  eyebrow: 'Analyze & review',
  title: 'Findings',
  description: 'Review high-impact findings first, keep or exclude rows, then download your corrected dataset.'
} as const

export const FINDING_TYPE_LABELS: Record<FindingType, string> = {
  DUPLICATE: 'Duplicated',
  POSSIBLE_DUPLICATE: 'Possible duplicate',
  INVALID: 'Invalid',
  MISSING: 'Missing',
  INCONSISTENT: 'Inconsistent',
  UNIQUENESS_VIOLATION: 'Not unique',
  NORMALIZATION_CONFLICT: 'Normalization conflict',
  RULE_VIOLATION: 'Rule violation'
}

export const FINDING_IMPACT_LABELS: Record<ImpactLevel, { badge: string; label: string }> = {
  large: { badge: 'high', label: 'High impact' },
  medium: { badge: 'med', label: 'Medium impact' },
  small: { badge: 'low', label: 'Low impact' }
}

export const INLINE_ROW_LIMIT = 2
