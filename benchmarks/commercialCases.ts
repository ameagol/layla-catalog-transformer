import type { CellValue, RuleCategory } from '../src/core/model/domain'
import type { RulePriority } from '../src/core/model/businessRules'
import type { RuleBenchmarkCase } from './model'
import { benchmarkCase } from './fixtures'
import { businessConfigurations, businessRules, validAccount } from '../tests/business-rule-fixtures'

export function commercialCases(): RuleBenchmarkCase[] {
  const categories: RuleCategory[] = ['missing', 'missing', 'consistency', 'consistency', 'missing', 'missing', 'validation', 'validation', 'missing', 'uniqueness', 'duplicate']
  const priorities: RulePriority[] = ['high', 'high', 'medium', 'high', 'medium', 'medium', 'medium', 'medium', 'medium', 'high', 'high']
  const actions = [
    'Route it to the Commercial Data Steward to assign an accountable owner.',
    'route it to the Data Steward for owner master-data correction.',
    "Route it to the account's current owner or the Data Steward to confirm the correct assignment.",
    'route it to Commercial Operations or the Data Steward.',
    'Route it to Commercial Operations for confirmation.',
    'Route it to the Account Owner to supply the missing value.',
    'route them to the Account Owner or Data Steward to correct the address data.',
    'route them to the Account Owner for verification.',
    'Route accounts that fail the applicable standard to the Account Owner.',
    'Route it to the Master Data Steward for investigation.',
    'Route them to the Master Data Steward for validation before any governed merge.'
  ]
  const fields = [
    ['Account category', 'SFDC Veg Owner'], ['Proposed Veg Owner FND ID'], ['SFDC Veg Owner', 'Veg Owner Name', 'Proposed Veg Owner FND ID'],
    ['Sales Organization', 'Sales Group', 'Sales Office'], ['SFDC Veg Owner'], ['Account Type', 'Veg Segmentation Type (SFDC)'],
    ['Country', 'State'], ['Country', 'Postal code'], ['Account Status', 'Account category', 'Phone', 'Email'],
    ['MDMi BPID', 'FNDG ID', 'Salesforce ID'], ['Name', 'Postal code']
  ]
  const deviations: Record<string, CellValue>[] = [
    { 'SFDC Veg Owner': '' }, { 'Proposed Veg Owner FND ID': '' }, { 'Proposed Veg Owner FND ID': 'Bob' },
    { 'Sales Office': 'Different' }, { 'SFDC Veg Owner': '' }, { 'Veg Segmentation Type (SFDC)': '' },
    { State: 'ZZ' }, { 'Postal code': '1234' }, { Phone: '', Email: '' }, {}, { Name: ' Gréen   Seeds ' }
  ]
  const cases: RuleBenchmarkCase[] = businessRules.map((rule, index) => ({
    id: `BENCH-${String(index + 1).padStart(3, '0')}`, family: 'supplied dataset-only commercial rules', sourceText: rule.sourceText,
    records: [{ ...validAccount }, { ...validAccount, ...deviations[index] }], configuration: businessConfigurations[rule.id],
    expected: { status: 'valid', category: categories[index]!, priority: priorities[index]!, actionItem: actions[index]!, fields: fields[index]!, flaggedRows: index >= 9 ? [2, 3] : [3] }
  }))
  cases.push(benchmarkCase(12, 'built-in email format', 'Email must be a valid email address.', [{ Email: 'customer@example.test' }, { Email: 'invalid' }], ['Email'], [3], 'Route it to the Account Owner to correct the email address.'))
  return cases
}
