import type { CellValue } from '../src/core/model/domain'
import type { RuleBenchmarkCase } from './model'
import { benchmarkCase } from './fixtures'

export function supportedCases(): RuleBenchmarkCase[] {
  const cases: RuleBenchmarkCase[] = []
  const add = (family: string, detection: string, records: Record<string, CellValue>[], fields: string[], flaggedRows: number[], action: string) => {
    const test = benchmarkCase(cases.length + 13, family, detection, records, fields, flaggedRows, action)
    if (['missing values', 'conditional required', 'minimum contact'].includes(family)) test.expected.category = 'missing'
    else if (family === 'exact uniqueness') test.expected.category = 'uniqueness'
    else if (family !== 'legacy vocabulary') test.expected.category = 'validation'
    cases.push(test)
  }
  const requiredFields = ['Email', 'Phone', 'Description', 'Customer Code', 'Account Name', 'Country', 'State', 'Postal code', 'Tax ID', 'SKU', 'Cost Center', 'Currency', 'Sales Office', 'External Reference', 'Nome completo', 'Delivery Address', 'Source System', 'Approval Notes']
  for (const [index, field] of requiredFields.entries()) {
    const wording = [
      `"${field}" is required.`, `The "${field}" field is mandatory.`, `"${field}" must not be blank.`,
      `"${field}" cannot be empty.`, `Flag rows where "${field}" is missing.`, `"${field}" must have a value.`
    ][index % 6]!
    add('missing values', wording, ['present', '', null, ' \t ', 0, false].map((value) => ({ [field]: value })), [field], [3, 4, 5], `Route to the Account Owner to complete ${field}.`)
  }
  const scopes = [
    ['Country', 'US', 'State'], ['Account Status', 'Active', 'Email'], ['Account Type', 'Grower', 'Segmentation'],
    ['Region', 'North', 'Sales Team'], ['Payment Method', 'Transfer', 'Bank Reference'], ['Product Type', 'Seed', 'Variety'],
    ['Currency', 'USD', 'Tax Code'], ['Channel', 'Distributor', 'Partner ID'], ['Delivery Mode', 'Courier', 'Postal code'],
    ['Approval Status', 'Approved', 'Approver'], ['Language', 'PT', 'Portuguese Description'], ['Customer Tier', 'Gold', 'Account Manager']
  ] as const
  for (const [field, value, target] of scopes) {
    add('conditional required', `If "${field}" is "${value}", "${target}" must not be blank.`, [
      { [field]: value, [target]: 'present' }, { [field]: value, [target]: '' }, { [field]: 'Out of scope', [target]: '' }
    ], [field, target], [3], `Route to the Data Steward to complete ${target} for the ${value} scope.`)
  }
  for (const [first, second] of [['Phone', 'Email'], ['Mobile', 'Office Phone'], ['Primary Email', 'Backup Email'], ['Billing Phone', 'Billing Email'], ['Contact Name', 'Contact ID'], ['Support Email', 'Support Phone']] as const) {
    add('minimum contact', `Flag rows where both "${first}" and "${second}" are blank.`, [
      { [first]: 'present', [second]: '' }, { [first]: '', [second]: 'present' }, { [first]: '', [second]: null }
    ], [first, second], [4], `Route to Customer Service to provide ${first} or ${second}.`)
  }
  const fragments = [
    ['Description', 'seed', false, false], ['Notes', 'obsolete', true, true], ['Account Name', 'Ltd', false, false],
    ['Internal Notes', 'test customer', true, true], ['Portuguese Description', 'café', false, true], ['Product Notes', 'do not sell', true, false],
    ['Email', '@', false, false], ['Website', 'javascript:', true, true], ['Address', 'Street', false, true],
    ['Comment', '<script>', true, false], ['Product Code', 'A.B', false, false], ['Customer Name', 'DUMMY', true, true]
  ] as const
  for (const [field, value, forbidden, insensitive] of fragments) {
    const match = `prefix ${insensitive ? value.toUpperCase() : value} suffix`
    const valid = forbidden ? 'clean value' : match
    const invalid = forbidden ? match : 'unrelated value'
    add('text fragments', `"${field}" must ${forbidden ? 'not ' : ''}contain "${value}"${insensitive ? ', ignoring case' : ''}.`, [
      { [field]: valid }, { [field]: invalid }, { [field]: '' }
    ], [field], forbidden ? [3] : [3, 4], `Route to Content Operations to review the ${value} fragment in ${field}.`)
  }
  for (const [field, prefix] of [['SKU', 'VEG-'], ['Purchase Order', 'PO/'], ['Country Code', 'US'], ['Telephone', '+1'], ['External Key', 'EXT_'], ['Website', 'https://'], ['Batch', 'LOT.'], ['Route Code', 'N-']] as const) {
    add('text prefixes', `"${field}" must start with "${prefix}".`, [
      { [field]: `${prefix}123` }, { [field]: `123${prefix}` }, { [field]: null }
    ], [field], [3, 4], `Route to the Master Data Steward to correct the ${field} prefix.`)
  }
  for (const [field, suffix] of [['Email', '@example.test'], ['Filename', '.csv'], ['Company Name', 'Ltd'], ['Product Code', '-US'], ['Document', '.pdf'], ['Locale', '_BR'], ['Export Name', '.xlsx'], ['Unit Label', 'kg']] as const) {
    add('text suffixes', `"${field}" must end with "${suffix}", case-insensitive.`, [
      { [field]: `record${suffix.toUpperCase()}` }, { [field]: `${suffix}extra` }, { [field]: '' }
    ], [field], [3, 4], `Route to Data Operations to verify the ${field} suffix.`)
  }
  for (const [field, allowed] of [
    ['Status', ['Active', 'Inactive']], ['Currency', ['USD', 'EUR', 'BRL']], ['Channel', ['Direct', 'Partner']],
    ['Consent', ['Yes', 'No']], ['Risk Level', ['Low', 'Medium', 'High']], ['Unit', ['kg', 'g']],
    ['Language', ['en', 'pt', 'es']], ['Account Type', ['Grower', 'Distributor']]
  ] as const) {
    add('allowed values', `"${field}" must be one of ${allowed.map((value) => `"${value}"`).join(', ')}, ignoring case.`, [
      { [field]: allowed[0].toUpperCase() }, { [field]: 'UNKNOWN' }, { [field]: '' }
    ], [field], [3, 4], `Route to the Account Owner to select an approved ${field} value.`)
  }
  for (const [field, minimum, maximum] of [['Age', 18, 120], ['Quantity', 1, 999], ['Discount', 0, 100], ['Temperature', -20, 50], ['Score', 0, 1], ['Lead Time', 0, 365], ['Latitude', -90, 90], ['Unit Price', 0.01, 10000]] as const) {
    add('numeric inputs', `"${field}" must be between ${minimum} and ${maximum} inclusive.`, [
      { [field]: minimum }, { [field]: String(maximum) }, { [field]: minimum - 1 }, { [field]: maximum + 1 },
      { [field]: '' }, { [field]: true }, { [field]: 'not a number' }, { [field]: '0x10' }
    ], [field], [4, 5, 6, 7, 8, 9], `Route to Data Quality to correct the numeric ${field} input.`)
  }
  for (const field of ['Customer ID', 'Invoice ID', 'Order ID', 'External Key', 'SKU', 'Serial Number', 'Email', 'Registration Code']) {
    add('exact uniqueness', `"${field}" must be unique across records.`, [
      { [field]: 'ABC-1' }, { [field]: 'ABC-1' }, { [field]: 'abc-1' }, { [field]: 'ABC1' }, { [field]: '' }, { [field]: null }
    ], [field], [2, 3], `Route to the Master Data Steward to investigate duplicate ${field} values.`)
  }
  const legacy: Array<[string, Record<string, CellValue>[], string[], number[], string]> = [
    ['Flag rows with a missing email.', [{ Email: 'ok@example.test' }, { Email: '' }], ['Email'], [3], 'Route to the Account Owner to supply the email.'],
    ['Phone is required.', [{ Phone: '2125551234' }, { Phone: null }], ['Phone'], [3], 'Route to Customer Service to supply the phone.'],
    ['Email must have a valid format.', [{ Email: 'ok@example.test' }, { Email: 'invalid-email' }], ['Email'], [3], 'Route to the Account Owner to verify the email format.'],
    ['CPF must be valid.', [{ CPF: '52998224725' }, { CPF: '11111111111' }], ['CPF'], [3], 'Route to the Data Steward to verify the CPF checksum.'],
    ['CNPJ must be valid.', [{ CNPJ: '11222333000181' }, { CNPJ: '11111111111111' }], ['CNPJ'], [3], 'Route to the Data Steward to verify the CNPJ checksum.'],
    ['Find duplicate customers with the same email.', [{ Email: 'same@example.test' }, { Email: 'same@example.test' }, { Email: 'other@example.test' }], ['Email'], [2, 3], 'Route to Customer Operations to validate the duplicate email.'],
    ['Find duplicates with the same name and phone.', [{ Name: 'Alice', Phone: '2125551234' }, { Name: 'Alice', Phone: '2125551234' }, { Name: 'Bob', Phone: '2125551234' }], ['Name', 'Phone'], [2, 3], 'Route to the Master Data Steward to review the matching name and phone.'],
    ['The same CPF cannot have different names.', [{ CPF: '52998224725', Name: 'Alice' }, { CPF: '52998224725', Name: 'Bob' }], ['CPF', 'Name'], [2, 3], 'Route to the Account Owner to resolve the conflicting names.'],
    ['Customer ID must be unique.', [{ 'Customer ID': '100' }, { 'Customer ID': '100' }, { 'Customer ID': '200' }], ['Customer ID'], [2, 3], 'Route to Master Data to review the repeated customer identifier.'],
    ['Find duplicate names with at least 90% similarity.', [{ Name: 'Green Seeds' }, { Name: 'Green Seed' }, { Name: 'Unrelated Customer' }], ['Name'], [2, 3], 'Route to Master Data for similarity review before merging.']
  ]
  for (const [detection, records, fields, rows, action] of legacy) add('legacy vocabulary', detection, records, fields, rows, action)
  const legacyCategories = ['missing', 'missing', 'validation', 'validation', 'validation', 'duplicate', 'duplicate', 'consistency', 'uniqueness', 'similarity'] as const
  cases.slice(-10).forEach((test, index) => { test.expected.category = legacyCategories[index]! })
  return cases
}
