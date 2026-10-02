import type { ValuePredicate } from '../model/businessRules'
import type { CellValue } from '../model/domain'
import { stringifyCellValue } from '../normalization/normalizers'

export function matchesValuePredicate(value: CellValue | undefined, predicate: ValuePredicate): boolean {
  const text = stringifyCellValue(value ?? null)
  if (predicate.operator === 'number_range') {
    if (typeof value !== 'number' && (typeof value !== 'string' || !/^[+-]?(?:\d+(?:\.\d+)?|\.\d+)$/u.test(value.trim()))) return false
    const number = Number(value)
    return Number.isFinite(number) && number >= predicate.minimum && number <= predicate.maximum
  }
  const normalized = predicate.caseSensitive ? text : text.toLowerCase()
  if (predicate.operator === 'one_of') return predicate.values.some((allowed) => normalized === (predicate.caseSensitive ? allowed : allowed.toLowerCase()))
  const expected = predicate.caseSensitive ? predicate.value : predicate.value.toLowerCase()
  const contains = predicate.operator === 'contains' ? normalized.includes(expected)
    : predicate.operator === 'starts_with' ? normalized.startsWith(expected) : normalized.endsWith(expected)
  return predicate.forbidden ? !contains : contains
}
