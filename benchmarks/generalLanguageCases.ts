import type { CellValue } from '../src/core/model/domain'

export interface GeneralLanguageCase {
  text: string
  records: Record<string, CellValue>[]
  rows: number[]
  missingColumns?: string[]
  blocked?: boolean
}

function required(text: string, field: string): GeneralLanguageCase {
  return { text, records: [null, '', ' \t ', 'present', 0, false].map((value) => ({ [field]: value })), rows: [2, 3, 4] }
}

export const generalLanguageCases: GeneralLanguageCase[] = [
  required('check if phone is not empty', 'Phone'),
  { text: 'check if column phone exists', records: [{ Phone: null }], rows: [] },
  { text: 'check if column name is duplicated', records: [{ Name: 'Alice' }, { Name: 'Alice' }, { Name: 'Bob' }], rows: [2, 3] },
  required('Phone should not be blank', 'Phone'),
  required('please make sure Invoice Reference has a value', 'Invoice Reference'),
  required('check for missing Delivery Contact', 'Delivery Contact'),
  required('Verify that Currency is populated', 'Currency'),
  required('Check for null Customer Ref', 'Customer Ref'),
  required('Check if Approved is not empty', 'Approved'),
  required('Verify the "tax-id" field is mandatory', 'tax-id'),
  required('Can you check if Product Code is missing?', 'Product Code'),
  required('Please ensure Delivery Contact is provided', 'Delivery Contact'),
  required('Validate that Quantity has data', 'Quantity'),
  required('Please make sure Notes isn’t blank', 'Notes'),
  { text: 'Ensure both Phone and Email are populated', records: [{ Phone: '', Email: 'email' }, { Phone: 'phone', Email: '' }, { Phone: 'phone', Email: 'email' }], rows: [2, 3] },
  { text: 'Find rows where Phone and Email are blank', records: [{ Phone: '', Email: '' }, { Phone: 'phone', Email: '' }], rows: [2] },
  { text: '"Phone" must not be empty and "Email" must not be empty', records: [{ Phone: '', Email: 'email' }, { Phone: 'phone', Email: '' }, { Phone: 'phone', Email: 'email' }], rows: [2, 3] },
  { text: 'If Status is Active, Phone must not be empty', records: [{ Status: 'Active', Phone: '' }, { Status: 'Inactive', Phone: '' }, { Status: 'Active', Phone: 'phone' }], rows: [2] },
  { text: 'Verify that if Order Type = Wholesale then Delivery Contact has a value', records: [{ 'Order Type': 'Wholesale', 'Delivery Contact': '' }, { 'Order Type': 'Retail', 'Delivery Contact': '' }], rows: [2] },
  { text: 'If Country is US and Status is Active, Email must not be blank', records: [{ Country: 'US', Status: 'Active', Email: '' }, { Country: 'CA', Status: 'Active', Email: '' }, { Country: 'US', Status: 'Inactive', Email: '' }], rows: [2] },
  { text: 'Look for repeated entries in Product Code', records: [{ 'Product Code': 'P1' }, { 'Product Code': 'P1' }, { 'Product Code': 'P2' }], rows: [2, 3] },
  { text: 'Product Code must be unique across records', records: [{ 'Product Code': 'P1' }, { 'Product Code': 'P1' }, { 'Product Code': '' }, { 'Product Code': '' }], rows: [2, 3] },
  { text: 'Check if "Batch Number" has duplicates', records: [{ 'Batch Number': 'B1' }, { 'Batch Number': 'B1' }, { 'Batch Number': null }], rows: [2, 3] },
  { text: 'Find duplicate values in "Store Code" and "Order Number"', records: [{ 'Store Code': 'A', 'Order Number': '1' }, { 'Store Code': 'A', 'Order Number': '1' }, { 'Store Code': 'A', 'Order Number': '2' }], rows: [2, 3] },
  { text: 'Make sure Billing Country matches Shipping Country', records: [{ 'Billing Country': 'US', 'Shipping Country': 'CA' }, { 'Billing Country': 'US', 'Shipping Country': 'US' }], rows: [2] },
  { text: 'Verify that Phone and Mobile contain the same values', records: [{ Phone: '123', Mobile: '456' }, { Phone: '123', Mobile: '123' }], rows: [2] },
  { text: 'Verify that all email addresses are valid', records: [{ Email: 'alice@example.test' }, { Email: 'not an email' }], rows: [3] },
  { text: 'Check if Email is invalid', records: [{ Email: 'alice@example.test' }, { Email: 'broken' }], rows: [3] },
  { text: 'Delivery Email should have a valid email address', records: [{ 'Delivery Email': 'alice@example.test' }, { 'Delivery Email': 'broken' }], rows: [3] },
  { text: 'Postal Code must match ZIP format', records: [{ 'Postal Code': '00501' }, { 'Postal Code': '1234' }], rows: [3] },
  { text: 'Check for invalid ZIP codes', records: [{ 'Postal Code': '00501' }, { 'Postal Code': '1234' }], rows: [3] },
  { text: 'Check that Amount is numeric', records: [{ Amount: 0 }, { Amount: '4.5' }, { Amount: 'abc' }], rows: [4] },
  { text: 'Verify that Invoice Date is a valid date', records: [{ 'Invoice Date': '2026-01-02' }, { 'Invoice Date': 'not a date' }], rows: [3] },
  { text: '"Notes" must contain "ready  now"', records: [{ Notes: 'ready  now' }, { Notes: 'ready now' }], rows: [3] },
  { text: 'Find rows where Notes contains "obsolete"', records: [{ Notes: 'obsolete item' }, { Notes: 'current item' }], rows: [2] },
  { text: 'Verify that the VAT ID column exists', records: [{ Name: 'Alice' }], rows: [], missingColumns: ['VAT ID'] },
  { text: 'Ensure columns Name and Phone exist', records: [{ Name: 'Alice' }], rows: [], missingColumns: ['Phone'] },
  { text: 'Check for missing column VAT ID', records: [{ Name: 'Alice' }], rows: [], missingColumns: ['VAT ID'] },
  { text: 'Check whether the worksheet has a column called Customer Ref', records: [{ Name: 'Alice' }], rows: [], missingColumns: ['Customer Ref'] },
  { text: 'The "Name of Child" column must exist', records: [{ Name: 'Alice' }], rows: [], missingColumns: ['Name of Child'] },
  ...[
    'Do not flag missing Phone',
    'Show rows where Phone is not empty',
    'Please find non-empty Phone values',
    'Phone must be empty',
    'Phone must not have a value',
    'Check if Phone is not empty unless Status is Inactive',
    'Delete duplicate rows with the same Phone',
    'Validate Phone against the external reference table'
  ].map((text) => ({ text, records: [{ Phone: '', Status: 'Active' }], rows: [], blocked: true }))
]
