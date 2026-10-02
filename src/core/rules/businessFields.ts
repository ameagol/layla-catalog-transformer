import type { FieldBinding, SemanticType, WorksheetProfile } from '../model/domain'
import { normalizeFieldLabel } from '../dataset/columnInference'

export const FIELD_ALIASES: Record<string, string[]> = {
  'Account category': ['Account Category', 'Account Classification'],
  'SFDC Veg Owner': ['SFDC Vegetable Owner', 'Current Owner', 'Vegetable Owner'],
  'Proposed Veg Owner FND ID': ['Proposed Vegetable Owner FND ID', 'Owner FND ID', 'Owner ID'],
  'Veg Owner Name': ['Vegetable Owner Name', 'Owner Name'],
  'Sales Organization': ['Sales Organisation', 'Sales Org'],
  'Sales Group': [],
  'Sales Office': [],
  'Expected Owner': ['Expected Owner/Team', 'Expected Owner Team', 'Assigned Owner'],
  'Veg Segmentation Type (SFDC)': ['Veg Segmentation Type', 'Vegetable Segmentation Type'],
  'Account Type': [],
  'Account Sub-Type': ['Account Subtype', 'Account Sub Type'],
  'Account Status': ['Status', 'Active Status'],
  Country: ['Country Code'],
  State: ['State Code', 'Province'],
  'Postal code': ['Postcode', 'PostalCode', 'ZIP', 'ZIP Code', 'Postal codes', 'Postcodes', 'ZIP codes'],
  'Postal format': ['Postal Code Format', 'Postcode Format'],
  Phone: ['Phone Number', 'Telephone'],
  Email: ['Email Address', 'E-mail'],
  Name: ['Customer Name', 'Account Name', 'Customer', 'Customer names', 'Names'],
  Address: ['Street Address', 'Street', 'Address Line 1'],
  'MDMi BPID': ['MDMI BP ID'],
  'FNDG ID': ['FNDGID'],
  'Salesforce ID': ['SalesforceId', 'SFDC ID']
}

function fieldSemanticType(token: string): SemanticType {
  if (/\b(?:id|bpid)$/iu.test(token)) return 'identifier'
  if (token === 'Phone') return 'phone'
  if (token === 'Email') return 'email'
  if (token === 'Name') return 'name'
  return 'text'
}

export function bindBusinessField(token: string, profile?: WorksheetProfile, mappings: Record<string, string> = {}): FieldBinding {
  const semanticType = fieldSemanticType(token)
  const explicit = mappings[token]
  const canonical = Object.keys(FIELD_ALIASES).find((field) => [field, ...FIELD_ALIASES[field]!].some((label) => normalizeFieldLabel(label) === normalizeFieldLabel(token)))
  const labels = [token, ...(canonical ? [canonical, ...FIELD_ALIASES[canonical]!] : [])].map(normalizeFieldLabel)
  const candidates = (profile?.columns ?? []).flatMap((column) => {
    const exact = normalizeFieldLabel(column.header) === labels[0]
    const matched = explicit ? column.key === explicit : labels.includes(normalizeFieldLabel(column.header))
    return matched ? [{ columnKey: column.key, columnHeader: column.header, score: explicit || exact ? 1 : 0.95, reason: explicit ? 'Confirmed project mapping.' : 'The column matches this field or an explicit field alias.' }] : []
  }).sort((left, right) => right.score - left.score)
  const first = candidates[0]
  const resolved = candidates.length === 1 || Boolean(first?.score === 1 && candidates[1]?.score !== 1)
  return {
    token, semanticType, role: 'target', candidates: candidates.slice(0, 10),
    status: resolved ? 'resolved' : candidates.length ? 'ambiguous' : 'missing',
    columnKey: resolved ? first?.columnKey : undefined,
    columnHeader: resolved ? first?.columnHeader : undefined
  }
}
