import type { Finding } from '../model/domain'

export function ownerForFinding(finding: Finding): string {
  if (finding.type === 'DUPLICATE' || finding.type === 'POSSIBLE_DUPLICATE') return 'Data steward and record owner'
  if (finding.type === 'MISSING' || finding.type === 'INVALID') return 'Record owner, with data steward review'
  return 'Data steward'
}

export function impactForFinding(finding: Finding): string {
  switch (finding.type) {
    case 'DUPLICATE':
    case 'POSSIBLE_DUPLICATE':
      return 'Duplicate records may distort counts or aggregation. Confirm whether the records refer to the same entity.'
    case 'MISSING':
      return 'A missing value may affect processes or reports that require this field.'
    case 'INVALID':
      return 'An invalid value may disrupt processes or reports that use this field.'
    case 'INCONSISTENT':
    case 'UNIQUENESS_VIOLATION':
      return 'Conflicting values may cause records to be grouped or reported incorrectly. Check the authorized source.'
    default:
      return 'Analyses and processes that rely on this field may be affected; the impact depends on the business rule.'
  }
}
