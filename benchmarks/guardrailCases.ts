import type { CellValue } from '../src/core/model/domain'
import type { RuleBenchmarkCase } from './model'
import { benchmarkCase } from './fixtures'

export function guardrailCases(): RuleBenchmarkCase[] {
  const cases: RuleBenchmarkCase[] = []
  for (const field of ['Email', 'State', 'Postal code', 'Proposed Veg Owner FND ID', 'Tax ID', 'Sales Office', 'Segmentation', 'Description']) {
    const test = benchmarkCase(cases.length + 111, 'missing input columns', `"${field}" is required.`, [{ Unrelated: 'present' }], [], undefined, `Route to the Data Steward to map the missing ${field} input.`)
    test.expected.status = 'needs_mapping'
    cases.push(test)
  }
  const ambiguous = benchmarkCase(119, 'ambiguous input columns', '"Email" must not be blank.', [{ 'Email Address': 'primary@example.test', 'E-mail': 'secondary@example.test' }], [], undefined, 'Route to the analyst to choose the intended email column.')
  ambiguous.expected.status = 'needs_mapping'
  cases.push(ambiguous)
  const stale = benchmarkCase(120, 'stale input mapping', '"Customer Code" is mandatory.', [{ 'Customer Code': '123' }], [], undefined, 'Route to the analyst to replace the stale column mapping.', { columnMappings: { 'Customer Code': 'deleted-column' } })
  stale.expected.status = 'needs_mapping'
  cases.push(stale)
  const localCases: Array<[string, Record<string, CellValue>[], string[], number[]]> = [
    ['The proposed owner must be identifiable. If the Proposed Veg Owner FND ID is blank.', [{ 'Proposed Veg Owner FND ID': 'ANY-ID' }, { 'Proposed Veg Owner FND ID': '' }], ['Proposed Veg Owner FND ID'], [3]],
    ['SFDC Veg Owner, Veg Owner Name and Proposed Veg Owner FND ID must identify the same person.', [{ 'SFDC Veg Owner': 'Alice', 'Veg Owner Name': 'Alice', 'Proposed Veg Owner FND ID': 'Alice' }, { 'SFDC Veg Owner': 'Alice', 'Veg Owner Name': 'Alice', 'Proposed Veg Owner FND ID': 'Bob' }], ['SFDC Veg Owner', 'Veg Owner Name', 'Proposed Veg Owner FND ID'], [3]],
    ['If Sales Organization, Sales Group and Sales Office be different.', [{ 'Sales Organization': 'A', 'Sales Group': 'A', 'Sales Office': 'A' }, { 'Sales Organization': 'A', 'Sales Group': 'B', 'Sales Office': 'A' }], ['Sales Organization', 'Sales Group', 'Sales Office'], [3]],
    ['The owner must align with the commercial structure. If the current owner does not exists.', [{ 'Current Owner': 'anyone' }, { 'Current Owner': null }], ['Current Owner'], [3]],
    ['"Billing Country" and "Shipping Country" must match.', [{ 'Billing Country': 'US', 'Shipping Country': 'US' }, { 'Billing Country': 'US', 'Shipping Country': 'CA' }], ['Billing Country', 'Shipping Country'], [3]],
    ['If "Status" = "Active", "Phone" cannot be empty.', [{ Status: 'Active', Phone: '' }, { Status: 'Inactive', Phone: '' }, { Status: 'Active', Phone: '2125551234' }], ['Status', 'Phone'], [2]],
    ['If "Country" = "US", "Postal code" must match ZIP format.', [{ Country: 'US', 'Postal code': '00501' }, { Country: 'USA', 'Postal code': '00501-1234' }, { Country: 'CA', 'Postal code': 'K1A 0B1' }], ['Country', 'Postal code'], [3]],
    ['If Account Type equals SME and Veg Segmentation Type (SFDC) is blank.', [{ 'Account Type': 'SME', 'Veg Segmentation Type (SFDC)': '' }, { 'Account Type': 'Other', 'Veg Segmentation Type (SFDC)': '' }], ['Account Type', 'Veg Segmentation Type (SFDC)'], [2]],
    ['"Postal code" must match ZIP or ZIP+4 format.', [{ 'Postal code': '00501' }, { 'Postal code': '00501-1234' }, { 'Postal code': '0050A' }], ['Postal code'], [4]],
    ['If "Status" is "Active", "Email" must be a valid email address.', [{ Status: 'Active', Email: 'bad' }, { Status: 'Inactive', Email: 'bad' }, { Status: 'Active', Email: 'good@example.test' }], ['Status', 'Email'], [2]]
  ]
  localCases.forEach(([detection, records, fields, flagged], index) => cases.push(benchmarkCase(index + 121, 'dataset-only conditions and comparisons', detection, records, fields, flagged, `Route to the Account Owner to resolve local validation ${index + 1}.`)))
  const unsupported = [
    'Make every customer record perfect.',
    'Predict likely customer churn from Notes.',
    'If "Status" is "Active", "Email" is required unless the customer opted out.',
    "Email must end with '@example.test'.",
    "Customer Name must contain 'Ltd'.",
    '"Notes" must match the regular expression "(a+)+$".',
    '"Score" must be between 100 and 0.',
    '"SKU" must contain "".',
    'Email must have a valid format only if Account Type is Corporate.',
    'Do not flag missing email values.',
    'Never check invalid CPF values.',
    '"Amount" must be numeric and greater than 0.',
    'Birth Date must be before today.',
    '"Notes" must contain "alpha" or "beta".',
    '"Notes" must contain "alpha" and "Email" must be valid.',
    'Delete every row whose email is invalid.',
    'Automatically merge duplicate customers using email.',
    'For customers in the north region, flag a missing phone.',
    'Flag overdue invoices.',
    'Validate Tax Code against the tax authority website.'
  ]
  for (const [index, detection] of unsupported.entries()) {
    const test = benchmarkCase(index + 131, 'unsupported or ambiguous intent', detection, [{
      Notes: 'alpha', Email: 'contact@example.test', 'Customer Name': 'Acme', CPF: '52998224725', Amount: 42,
      'Birth Date': '2000-01-01', Phone: '2125551234', Score: 10, SKU: 'VEG-1', Status: 'Active', 'Account Type': 'Corporate', 'Tax Code': 'CODE'
    }], undefined, undefined, `Route to the analyst to clarify the requested operation ${index + 1}.`)
    test.expected.status = 'unsupported'
    if (index === 3 || index === 4) {
      test.family = 'unquoted fields and single-quoted text fragments'
      test.expected.status = 'valid'
      test.expected.category = 'validation'
      test.expected.fields = [index === 3 ? 'Email' : 'Customer Name']
      test.expected.flaggedRows = index === 3 ? [] : [2]
    }
    cases.push(test)
  }
  return cases
}
