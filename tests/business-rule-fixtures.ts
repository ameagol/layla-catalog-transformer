import { readFileSync } from 'node:fs'

import type { RuleConfiguration } from '../src/core/model/businessRules'
import type { CellValue, DatasetRow } from '../src/core/model/domain'
import { profileWorksheet } from '../src/core/dataset/profiling'
import { parseSourceRules } from '../src/core/rules/source'

export const businessRuleText = readFileSync(new URL('../samples/customer-governance-rules.txt', import.meta.url), 'utf8')
export const businessRules = parseSourceRules(businessRuleText)

export const validAccount: Record<string, CellValue> = {
  'Account category': 'Transactional Account', 'SFDC Veg Owner': 'Alice',
  'Proposed Veg Owner FND ID': 'Alice', 'Veg Owner Name': 'Alice',
  'Sales Organization': 'Sales-A', 'Sales Group': 'Sales-A', 'Sales Office': 'Sales-A',
  'Veg Segmentation Type (SFDC)': 'Commercial', 'Account Type': 'Grower', 'Account Sub-Type': 'Customer',
  Country: 'US', State: 'NY', 'Postal code': '00501', Phone: '2125551234', Email: 'alice@example.test',
  'Account Status': 'Active', Name: 'Green Seeds', Address: '1 Main Street',
  'MDMi BPID': 'MDM-1', 'FNDG ID': 'FND-1', 'Salesforce ID': '001ABC'
}

export function accountRow(rowNumber: number, values: Record<string, CellValue> = {}): DatasetRow {
  return { rowNumber, values: { ...validAccount, ...values } }
}

export function referenceDataset(name: string, records: Record<string, CellValue>[]) {
  const columns = Object.keys(records[0] ?? {}).map((header, index) => ({ key: header, header, index }))
  const rows = records.map((values, index) => ({ rowNumber: index + 2, values }))
  return { profile: profileWorksheet(name, 1, columns, rows), rows }
}

export const businessProfile = referenceDataset('Accounts', [validAccount]).profile
export const businessConfigurations: Record<string, RuleConfiguration> = {
  [businessRules[5]!.id]: { conditionValues: { 'Account Type': ['Grower'] } }
}

export const businessContext = { ruleConfigurations: businessConfigurations }
