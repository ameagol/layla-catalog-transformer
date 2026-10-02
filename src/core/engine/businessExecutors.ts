import type { CompiledRule, DatasetRow, Finding, FindingType } from '../model/domain'
import { executeBusinessDuplicates } from './businessDuplicates'
import { businessFinding, businessValue, sourceValue } from './businessValues'
import { matchesValuePredicate } from './valuePredicates'
import { checkConfigurationWarnings, describeBusinessCheck } from '../rules/businessChecks'
import { stringifyCellValue } from '../normalization/normalizers'
import { matchesDatasetFormat } from '../validation/datasetFormats'
import { createFindingId } from '../findings/factory'

export function executeBusinessRule(rows: DatasetRow[], rule: CompiledRule, sheet: string, createdAt: string): { findings: Finding[]; warnings: string[] } {
  if (rule.plan?.kind !== 'business') return { findings: [], warnings: [] }
  const plan = rule.plan
  const check = plan.check
  const invalid = checkConfigurationWarnings(check)
  if (invalid.length) throw new Error(invalid.join(' '))
  if (check.kind === 'columns_exist') return { findings: check.targets.filter((token) => !plan.fields[token]).map((token) => ({
    id: createFindingId('MISSING', `${rule.id}:column:${token}`, []), scope: 'worksheet', type: 'MISSING', severity: rule.severity,
    priority: rule.interpretation.priority, confidence: 'HIGH', ruleId: rule.id, ruleText: rule.sourceText, sheet,
    rowNumbers: [], fields: [token], evidence: [], explanation: `The ${token} column is missing from worksheet “${sheet}”.`,
    suggestedAction: rule.interpretation.actionItem ?? `Add the ${token} column or correct its header, then reload the dataset and run the checks again.`, createdAt
  })), warnings: [] }
  if (check.kind === 'unique_any' || check.kind === 'weighted_duplicate' || check.kind === 'duplicate_fields') return { findings: executeBusinessDuplicates(rows, rule, plan, sheet, createdAt), warnings: [] }
  const findings: Finding[] = []
  for (const row of rows) {
    const when = 'when' in check ? check.when : undefined
    const scopes = when?.clauses.map((clause) => clause.values.some((value) => businessValue(value, clause.field) === sourceValue(row, plan, clause.field)))
    if (scopes && !(when?.logic === 'or' ? scopes.some(Boolean) : scopes.every(Boolean))) continue
    let affected: string[] = []
    let explanation = ''
    let type: FindingType = 'INVALID'
    if (check.kind === 'required') {
      const missing = check.targets.filter((token) => !sourceValue(row, plan, token))
      if (check.match === 'all' ? missing.length === check.targets.length : missing.length > 0) {
        affected = missing
        type = 'MISSING'
        explanation = `Row ${row.rowNumber} meets the rule's scope but has no value in ${missing.join(' and ')}.`
      }
    } else if (check.kind === 'value_check') {
      if (!matchesValuePredicate(row.values[plan.fields[check.field]!.columnKey], check.predicate)) {
        affected = [check.field]
        explanation = `${check.field} does not satisfy the rule. ${describeBusinessCheck(check)}`
      }
    } else if (check.kind === 'format') {
      if (!matchesDatasetFormat(row.values[plan.fields[check.field]!.columnKey] ?? null, check.format)) {
        affected = [check.field]
        explanation = `${check.field} does not satisfy the rule. ${describeBusinessCheck(check)}`
      }
    } else if (check.kind === 'same_fields') {
      const values = check.targets.map((token) => stringifyCellValue(row.values[plan.fields[token]!.columnKey] ?? null).trim())
      if (new Set(values).size > 1) {
        affected = check.targets
        type = 'INCONSISTENT'
        explanation = `${check.targets.join(', ')} contain different values in row ${row.rowNumber}.`
      }
    }
    if (affected.length) findings.push(businessFinding(rule, plan, [row], affected, type, explanation, sheet, createdAt))
  }
  return { findings, warnings: [] }
}
