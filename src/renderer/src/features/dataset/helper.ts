import type { SemanticType } from '@core/model/domain'

export function formatPercent(value: number): string {
  return `${(value * 100).toFixed(value < 0.01 ? 1 : 0)}%`
}

export function semanticLabel(value: SemanticType): string {
  return value === 'unknown' ? 'Needs review' : value.toUpperCase()
}
