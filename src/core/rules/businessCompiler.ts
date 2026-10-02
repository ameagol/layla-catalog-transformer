import type { BusinessExecutionPlan } from '../model/businessRules'
import type { RuleInterpretation } from '../model/domain'
import { businessFields, checkConfigurationWarnings } from './businessChecks'

export function compileBusinessPlan(interpretation: RuleInterpretation): BusinessExecutionPlan {
  const check = interpretation.businessCheck
  if (!check) throw new Error('Missing business check.')
  const warnings = checkConfigurationWarnings(check)
  if (warnings.length) throw new Error(warnings.join(' '))
  const fields: BusinessExecutionPlan['fields'] = {}
  for (const token of businessFields(check)) {
    const binding = interpretation.fields.find((field) => field.token === token)
    if (check.kind === 'columns_exist' && binding?.status === 'missing') continue
    if (binding?.status !== 'resolved' || !binding.columnKey || !binding.columnHeader) throw new Error(`Confirm the input column for ${token}.`)
    fields[token] = { columnKey: binding.columnKey, columnHeader: binding.columnHeader, semanticType: binding.semanticType }
  }
  if (!Object.keys(fields).length && check.kind !== 'columns_exist') throw new Error('The check needs at least one input field.')
  if (check.kind === 'columns_exist' && !check.targets.length) throw new Error('Name at least one column to check.')
  if ((check.kind === 'same_fields' || check.kind === 'duplicate_fields') && new Set(Object.values(fields).map((field) => field.columnKey)).size !== check.targets.length) throw new Error('Map each compared field to a different source column.')
  return { kind: 'business', check, fields }
}
