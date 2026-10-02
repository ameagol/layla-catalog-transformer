import type { BusinessCheck } from '../model/businessRules'
import { describeBusinessCheck } from './businessChecks'
import { DATASET_FORMAT_LABELS } from '../validation/datasetFormats'

export function layaBusinessIntent(check: BusinessCheck): string {
  if (check.kind === 'columns_exist') return `Check that the worksheet contains these columns: ${check.targets.join(', ')}.`
  const scope = 'when' in check && check.when ? ` Applies to records where ${check.when.clauses.map((clause) => `${clause.field} is ${clause.values.length ? clause.values.join(' or ') : 'one of the explicitly specified values'}`).join(` ${check.when.logic} `)}.` : ''
  if (check.kind === 'value_check') return `Check each value of ${check.field}. ${describeBusinessCheck(check)}`
  if (check.kind === 'format') {
    if (check.format === 'zip' && check.field === 'Postal code' && check.when?.clauses.length === 1 && check.when.clauses[0]?.field === 'Country' && check.when.clauses[0]?.values.length === 1 && check.when.clauses[0]?.values[0] === 'US') return 'Check that US postal codes match the ZIP format. Flag invalid postal codes.'
    return `Find invalid ${check.field} values that do not match ${DATASET_FORMAT_LABELS[check.format]}.${scope}`
  }
  if (check.kind === 'required') return `Find missing required ${check.targets.join(check.match === 'all' ? ' and ' : ' or ')} values.${check.match === 'all' ? ' Flag only when all these fields are blank.' : ''}${scope}`
  if (check.kind === 'same_fields') return `Compare the values of ${check.targets.join(', ')} within each row. Flag a conflict when these fields have different values.`
  if (check.kind === 'unique_any') return `Find duplicates across records. Each ${check.targets.join(', ')} must be unique independently.`
  if (check.kind === 'duplicate_fields') return `Find duplicate records whose ${check.normalized ? 'normalized ' : ''}${check.targets.join(' and ')} match exactly.`
  if (check.kind === 'weighted_duplicate') return 'Find probable duplicate customers using exact normalized name and postcode matches or weighted name, address and postal-code similarity above the agreed threshold. Recommend validation before merging.'
  return 'This request is not a supported dataset-only validation.'
}
