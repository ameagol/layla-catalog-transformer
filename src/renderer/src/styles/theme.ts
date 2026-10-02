import type { FindingType } from '@core/model/domain'

export function applyTheme(): void {
  document.documentElement.dataset.theme = 'light'
}

export const FINDING_COLORS: Record<FindingType, { ink: string; fill: string }> = {
  DUPLICATE: { ink: 'var(--badge-orange)', fill: 'var(--signal-soft)' },
  MISSING: { ink: 'var(--danger)', fill: 'var(--danger-soft)' },
  POSSIBLE_DUPLICATE: { ink: 'var(--badge-amber)', fill: 'var(--warning-soft)' },
  INVALID: { ink: 'var(--badge-violet)', fill: 'var(--badge-violet-soft)' },
  INCONSISTENT: { ink: 'var(--badge-blue)', fill: 'var(--badge-blue-soft)' },
  UNIQUENESS_VIOLATION: { ink: 'var(--badge-teal)', fill: 'var(--aqua-soft)' },
  NORMALIZATION_CONFLICT: { ink: 'var(--badge-rose)', fill: 'var(--badge-rose-soft)' },
  RULE_VIOLATION: { ink: 'var(--badge-olive)', fill: 'var(--badge-olive-soft)' }
}
