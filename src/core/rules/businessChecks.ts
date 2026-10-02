import type { BusinessCheck } from '../model/businessRules'
import { DATASET_FORMAT_LABELS } from '../validation/datasetFormats'

export function businessFields(check: BusinessCheck): string[] {
  if (check.kind === 'required' || check.kind === 'format' || check.kind === 'value_check') {
    return [...new Set([...(check.kind === 'required' ? check.targets : [check.field]), ...(check.when?.clauses.map((clause) => clause.field) ?? [])])]
  }
  if (check.kind === 'columns_exist' || check.kind === 'same_fields' || check.kind === 'unique_any' || check.kind === 'duplicate_fields') return [...new Set(check.targets)]
  if (check.kind === 'weighted_duplicate') return [...new Set([...check.exactFields, ...check.weightedFields])]
  return []
}

export function describeBusinessCheck(check: BusinessCheck): string {
  if (check.kind === 'columns_exist') return `Check that the worksheet contains ${check.targets.map((field) => `the ${field} column`).join(' and ')}. This checks column presence, not whether its cells are empty. A missing column is reported as a worksheet issue.`
  const scope = 'when' in check && check.when ? `(${check.when.clauses.map((clause) => `${clause.field} IN [${clause.values.join(', ')}]`).join(` ${check.when.logic.toUpperCase()} `)}) AND ` : ''
  if (check.kind === 'format') return `${scope}${check.field} fails ${DATASET_FORMAT_LABELS[check.format]}. This is a built-in check; no external data is used.`
  if (check.kind === 'value_check') {
    const predicate = check.predicate
    if (predicate.operator === 'number_range') return `${scope}${check.field} must be numeric and between ${predicate.minimum} and ${predicate.maximum}, inclusive. Blank values fail.`
    if (predicate.operator === 'one_of') return `${scope}${check.field} must be one of ${predicate.values.map((value) => JSON.stringify(value)).join(', ')} (${predicate.caseSensitive ? 'case-sensitive' : 'case-insensitive'}).`
    const operation = predicate.operator === 'contains' ? 'contain' : predicate.operator === 'starts_with' ? 'start with' : 'end with'
    return `${scope}${check.field} must ${predicate.forbidden ? 'not ' : ''}${operation} ${JSON.stringify(predicate.value)} (${predicate.caseSensitive ? 'case-sensitive' : 'case-insensitive'}).`
  }
  if (check.kind === 'required') return `${scope}(${check.targets.map((field) => `${field} is blank`).join(check.match === 'all' ? ' AND ' : ' OR ')})`
  if (check.kind === 'same_fields') return `Compare ${check.targets.join(' = ')} within each row. Flag the row if any value differs. Compare cell text after trimming surrounding whitespace; case and punctuation remain significant. No reference data is required.`
  if (check.kind === 'unique_any') return `Each of ${check.targets.join(', ')} must be unique independently. Blank identifiers are ignored; case and punctuation remain significant.`
  if (check.kind === 'duplicate_fields') return `Find rows with the same ${check.normalized ? 'normalized ' : ''}combination of ${check.targets.join(' + ')}. Ignore rows missing any comparison value. No fuzzy matching or automatic merge.`
  if (check.kind === 'weighted_duplicate') return `Normalized ${check.exactFields.join(' + ')} match exactly OR weighted similarity of ${check.weightedFields.join(' + ')} reaches ${check.threshold === undefined ? 'a confirmed threshold' : `${Math.round(check.threshold * 100)}%`}. Confirm weights before running; no automatic merge.`
  return 'External-reference checks are not supported. Write a condition using fields in this dataset and explicit values instead.'
}

export function checkConfigurationWarnings(check: BusinessCheck): string[] {
  if (!['columns_exist', 'required', 'format', 'value_check', 'same_fields', 'unique_any', 'duplicate_fields', 'weighted_duplicate'].includes(check.kind)) return [describeBusinessCheck(check)]
  if ('when' in check && check.when) {
    const incomplete = check.when.clauses.filter((clause) => !clause.values.length || clause.values.some((value) => !value.trim()))
    if (incomplete.length) return incomplete.map((clause) => `Specify the applicable ${clause.field} values in the rule or the inline condition values below. No external worksheet is needed.`)
  }
  if (check.kind === 'same_fields') return new Set(check.targets).size < 2 ? ['Name at least two different fields to compare within each row.'] : []
  if (check.kind !== 'weighted_duplicate') return []
  const weights = check.weightedFields.map((field) => check.weights?.[field])
  const validWeights = weights.every((weight) => weight !== undefined && Number.isFinite(weight) && weight > 0 && weight <= 1)
    && Math.abs(weights.reduce<number>((sum, weight) => sum + (weight ?? 0), 0) - 1) < 0.000001
  return [
    ...(check.threshold === undefined || !Number.isFinite(check.threshold) || check.threshold <= 0 || check.threshold > 1 ? ['Confirm a similarity threshold greater than 0 and no higher than 100%; an example is not an approved policy.'] : []),
    ...(!validWeights ? ['Confirm a positive weight for each similarity field; weights must total 100%.'] : [])
  ]
}
