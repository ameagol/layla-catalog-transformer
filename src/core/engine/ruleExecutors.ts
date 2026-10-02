import type { CompiledRule, DatasetRow, Finding } from '../model/domain'
import { createFindingId } from '../findings/factory'
import { isMissingValue } from '../normalization/normalizers'
import { validateValue } from '../validation/validators'
import { NormalizationCache } from './normalizationCache'

export function executeValidationRule(
  rows: DatasetRow[],
  rule: CompiledRule,
  sheetName: string,
  createdAt: string
): Finding[] {
  if (!rule.plan || rule.plan.kind !== 'validation') return []
  const { field, validator } = rule.plan
  const findings: Finding[] = []

  for (const row of rows) {
    const originalValue = row.values[field.columnKey] ?? null
    const result = validateValue(originalValue, validator)
    if (result.valid) continue

    findings.push({
      id: createFindingId('INVALID', rule.id, [row.rowNumber]),
      type: 'INVALID',
      severity: rule.severity,
      confidence: 'HIGH',
      ruleId: rule.id,
      ruleText: rule.sourceText,
      sheet: sheetName,
      rowNumbers: [row.rowNumber],
      fields: [field.columnHeader],
      evidence: [
        {
          rowNumber: row.rowNumber,
          columnKey: field.columnKey,
          columnHeader: field.columnHeader,
          originalValue,
          normalizedValue: result.normalizedValue,
          comparator: validator
        }
      ],
      explanation: result.reason,
      suggestedAction: `Correct or remove the invalid ${field.columnHeader} value.`,
      createdAt
    })
  }

  return findings
}

export function executeMissingRule(
  rows: DatasetRow[],
  rule: CompiledRule,
  sheetName: string,
  createdAt: string
): Finding[] {
  if (!rule.plan || rule.plan.kind !== 'missing') return []
  const { field } = rule.plan

  return rows
    .filter((row) => isMissingValue(row.values[field.columnKey] ?? null))
    .map((row) => ({
      id: createFindingId('MISSING', rule.id, [row.rowNumber]),
      type: 'MISSING' as const,
      severity: rule.severity,
      confidence: 'HIGH' as const,
      ruleId: rule.id,
      ruleText: rule.sourceText,
      sheet: sheetName,
      rowNumbers: [row.rowNumber],
      fields: [field.columnHeader],
      evidence: [
        {
          rowNumber: row.rowNumber,
          columnKey: field.columnKey,
          columnHeader: field.columnHeader,
          originalValue: row.values[field.columnKey] ?? null,
          normalizedValue: '',
          comparator: 'required value'
        }
      ],
      explanation: `Row ${row.rowNumber} has no value in the required ${field.columnHeader} field.`,
      suggestedAction: `Supply a ${field.columnHeader} value or confirm that the rule should not apply to this record.`,
      createdAt
    }))
}

export function executeUniquenessRule(
  rows: DatasetRow[],
  rule: CompiledRule,
  sheetName: string,
  cache: NormalizationCache,
  createdAt: string
): Finding[] {
  if (!rule.plan || rule.plan.kind !== 'uniqueness') return []
  const { field, normalizations } = rule.plan
  const groups = new Map<string, DatasetRow[]>()

  for (const row of rows) {
    const normalizedValue = cache.get(row, field, normalizations)
    if (!normalizedValue) continue
    const group = groups.get(normalizedValue) ?? []
    group.push(row)
    groups.set(normalizedValue, group)
  }

  return [...groups.entries()]
    .filter(([, group]) => group.length > 1)
    .map(([normalizedValue, group]) => {
      const rowNumbers = group.map((row) => row.rowNumber).sort((left, right) => left - right)
      return {
        id: createFindingId('UNIQUENESS_VIOLATION', rule.id, rowNumbers),
        type: 'UNIQUENESS_VIOLATION' as const,
        severity: rule.severity,
        confidence: 'HIGH' as const,
        ruleId: rule.id,
        ruleText: rule.sourceText,
        sheet: sheetName,
        rowNumbers,
        fields: [field.columnHeader],
        evidence: group.map((row) => ({
          rowNumber: row.rowNumber,
          columnKey: field.columnKey,
          columnHeader: field.columnHeader,
          originalValue: row.values[field.columnKey] ?? null,
          normalizedValue,
          comparator: 'must be unique'
        })),
        explanation: `${field.columnHeader} resolves to the same normalized value in rows ${rowNumbers.join(', ')}.`,
        suggestedAction: 'Confirm whether these rows are duplicates or assign distinct identifiers.',
        createdAt
      }
    })
}

export function executeConsistencyRule(
  rows: DatasetRow[],
  rule: CompiledRule,
  sheetName: string,
  cache: NormalizationCache,
  createdAt: string
): Finding[] {
  if (!rule.plan || rule.plan.kind !== 'consistency') return []
  const { keyField, dependentField, keyNormalizations, dependentNormalizations } = rule.plan
  const groups = new Map<string, DatasetRow[]>()

  for (const row of rows) {
    const key = cache.get(row, keyField, keyNormalizations)
    if (!key) continue
    const group = groups.get(key) ?? []
    group.push(row)
    groups.set(key, group)
  }

  const findings: Finding[] = []
  for (const [normalizedKey, group] of groups) {
    const dependentValues = new Set(
      group
        .map((row) => cache.get(row, dependentField, dependentNormalizations))
        .filter(Boolean)
    )
    if (dependentValues.size <= 1) continue

    const rowNumbers = group.map((row) => row.rowNumber).sort((left, right) => left - right)
    findings.push({
      id: createFindingId('INCONSISTENT', rule.id, rowNumbers),
      type: 'INCONSISTENT',
      severity: rule.severity,
      confidence: 'HIGH',
      ruleId: rule.id,
      ruleText: rule.sourceText,
      sheet: sheetName,
      rowNumbers,
      fields: [keyField.columnHeader, dependentField.columnHeader],
      evidence: group.flatMap((row) => [
        {
          rowNumber: row.rowNumber,
          columnKey: keyField.columnKey,
          columnHeader: keyField.columnHeader,
          originalValue: row.values[keyField.columnKey] ?? null,
          normalizedValue: normalizedKey,
          comparator: 'consistency key'
        },
        {
          rowNumber: row.rowNumber,
          columnKey: dependentField.columnKey,
          columnHeader: dependentField.columnHeader,
          originalValue: row.values[dependentField.columnKey] ?? null,
          normalizedValue: cache.get(row, dependentField, dependentNormalizations),
          comparator: 'must remain consistent'
        }
      ]),
      explanation: `The same normalized ${keyField.columnHeader} is associated with ${dependentValues.size} different ${dependentField.columnHeader} values.`,
      suggestedAction: `Review rows ${rowNumbers.join(', ')} and correct the conflicting ${dependentField.columnHeader} values.`,
      createdAt
    })
  }

  return findings
}

