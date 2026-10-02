import type { BusinessExecutionPlan } from '../model/businessRules'
import type { CellValue, CompiledRule, DatasetRow, Finding, FindingType } from '../model/domain'
import { createFindingId } from '../findings/factory'
import { stringifyCellValue } from '../normalization/normalizers'

export function businessValue(value: CellValue | undefined, token: string): string {
  const text = stringifyCellValue(value ?? null).trim()
  if (/\b(?:id|bpid)$/iu.test(token)) return text
  const normalized = text.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/gu, ' ')
  if (/^country(?: code)?$/iu.test(token) && ['us', 'usa', 'united states', 'united states of america'].includes(normalized)) return 'us'
  return normalized
}

export function sourceValue(row: DatasetRow, plan: BusinessExecutionPlan, token: string): string {
  const field = plan.fields[token]
  if (!field) throw new Error(`Missing compiled field: ${token}.`)
  return businessValue(row.values[field.columnKey], token)
}

export function businessFinding(rule: CompiledRule, plan: BusinessExecutionPlan, rows: DatasetRow[], tokens: string[], type: FindingType, explanation: string, sheet: string, createdAt: string): Finding {
  const rowNumbers = rows.map((row) => row.rowNumber).sort((left, right) => left - right)
  const fields = [...new Set(tokens)]
  return {
    id: createFindingId(type, `${rule.id}:${fields.join('|')}`, rowNumbers), type, severity: rule.severity,
    priority: rule.interpretation.priority, confidence: type === 'POSSIBLE_DUPLICATE' ? 'MEDIUM' : 'HIGH',
    ruleId: rule.id, ruleText: rule.sourceText, sheet, rowNumbers,
    fields: fields.map((token) => plan.fields[token]!.columnHeader),
    evidence: rows.flatMap((row) => fields.map((token) => {
      const field = plan.fields[token]!
      const rawValue = stringifyCellValue(row.values[field.columnKey] ?? null)
      const normalizedValue = plan.check.kind === 'unique_any' || plan.check.kind === 'same_fields' ? rawValue.trim()
        : plan.check.kind === 'value_check' ? plan.check.predicate.operator === 'number_range' ? rawValue.trim()
          : plan.check.predicate.caseSensitive ? rawValue : rawValue.toLowerCase()
          : sourceValue(row, plan, token)
      return { rowNumber: row.rowNumber, columnKey: field.columnKey, columnHeader: field.columnHeader,
        originalValue: row.values[field.columnKey] ?? null, normalizedValue, comparator: plan.check.kind }
    })),
    explanation, suggestedAction: rule.interpretation.actionItem ?? 'Review the flagged values with the accountable data owner.', createdAt
  }
}
