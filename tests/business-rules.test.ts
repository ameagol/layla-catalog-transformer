import { describe, expect, it } from 'vitest'
import { analyzeDataset } from '../src/core/engine/analyze'
import { compileInterpretations, compileRules } from '../src/core/rules/compiler'
import { interpretRules } from '../src/core/rules/interpreter'
import { parseSourceRules } from '../src/core/rules/source'
import { accountRow, businessContext, businessProfile, businessRules, businessRuleText } from './business-rule-fixtures'

const interpretations = interpretRules(businessRules, businessProfile, {}, businessContext)

async function runRule(index: number, rows = [accountRow(2)]) {
  return analyzeDataset({ projectId: 'test', sessionId: 'test', sheetName: 'Accounts', rows, compilation: compileInterpretations([interpretations[index]!]) })
}

describe('commercial rules use only the current dataset', () => {
  it('maps the eleven rules without creating reference requirements', () => {
    expect(parseSourceRules(businessRuleText)).toHaveLength(11)
    expect(interpretations.map((rule) => rule.businessCheck?.kind)).toEqual(['required', 'required', 'same_fields', 'same_fields', 'required', 'required', 'format', 'format', 'required', 'unique_any', 'duplicate_fields'])
    expect(interpretations.map((rule) => rule.status)).toEqual(Array(11).fill('valid'))
    expect(interpretations.every((rule) => !rule.reference && rule.actionItem && rule.priority)).toBe(true)
    expect(compileInterpretations(interpretations).canRun).toBe(true)
  })

  it('checks the conditional missing owner and preserves priority/action', async () => {
    const result = await runRule(0, [accountRow(2, { 'SFDC Veg Owner': '' }), accountRow(3, { 'Account category': 'Prospect', 'SFDC Veg Owner': '' })])
    expect(result.findings.map((finding) => finding.rowNumbers)).toEqual([[2]])
    expect(result.findings[0]?.fields).toEqual(['SFDC Veg Owner'])
    expect(result.findings[0]?.suggestedAction).toContain('Commercial Data Steward')
    expect(result.findings[0]?.priority).toBe('high')
  })

  it('checks only whether the proposed owner ID is blank, not whether it exists in a directory', async () => {
    const result = await runRule(1, [accountRow(2), accountRow(3, { 'Proposed Veg Owner FND ID': 'ANY-NONBLANK-ID' }), accountRow(4, { 'Proposed Veg Owner FND ID': ' ' })])
    expect(result.findings.map((finding) => finding.rowNumbers)).toEqual([[4]])
  })

  it('compares owner and sales fields directly inside each row', async () => {
    expect((await runRule(2)).findings).toEqual([])
    expect((await runRule(3)).findings).toEqual([])
    const owners = await runRule(2, [accountRow(2, { 'Veg Owner Name': 'Different' })])
    expect(owners.findings[0]?.fields).toEqual(['SFDC Veg Owner', 'Veg Owner Name', 'Proposed Veg Owner FND ID'])
    expect(owners.findings[0]?.priority).toBe('medium')
    expect((await runRule(3, [accountRow(2, { 'Sales Office': 'Different' })])).findings[0]?.fields).toEqual(['Sales Organization', 'Sales Group', 'Sales Office'])
  })

  it('uses the actual missing-owner condition instead of interpreting its commercial title', async () => {
    const result = await runRule(4, [accountRow(2, { 'SFDC Veg Owner': 'ANY-OWNER' }), accountRow(3, { 'SFDC Veg Owner': '' })])
    expect(result.findings.map((finding) => finding.rowNumbers)).toEqual([[3]])
    expect(result.findings[0]?.fields).toEqual(['SFDC Veg Owner'])
  })

  it('uses inline account-type values and asks for unspecified values without asking for a sheet', async () => {
    const result = await runRule(5, [accountRow(2, { 'Veg Segmentation Type (SFDC)': '' }), accountRow(3, { 'Account Type': 'Prospect', 'Veg Segmentation Type (SFDC)': '' })])
    expect(result.findings.map((finding) => finding.rowNumbers)).toEqual([[2]])
    const [unconfigured] = interpretRules([businessRules[5]!], businessProfile)
    expect(unconfigured?.status).toBe('needs_configuration')
    expect(unconfigured?.reference).toBeUndefined()
    expect(unconfigured?.warnings.join(' ')).toContain('Specify the applicable Account Type values')
  })

  it('uses built-in US states and checks only US records', async () => {
    const result = await runRule(6, [accountRow(2, { State: 'ZZ' }), accountRow(3, { Country: 'United States', State: 'New York' }), accountRow(4, { Country: 'BR', State: 'SP' }), accountRow(5, { State: '' })])
    expect(result.findings.map((finding) => finding.rowNumbers)).toEqual([[2], [5]])
    expect(result.findings[0]?.fields).toEqual(['State'])
    expect(result.warnings).toEqual([])
  })

  it('checks five-digit ZIPs without allowing ZIP+4 unless explicitly requested', async () => {
    const result = await runRule(7, [accountRow(2), accountRow(3, { 'Postal code': '00501-1234' }), accountRow(4, { 'Postal code': '1234' }), accountRow(5, { Country: 'CA', 'Postal code': 'K1A 0B1' }), accountRow(6, { 'Postal code': '' })])
    expect(result.findings.map((finding) => finding.rowNumbers)).toEqual([[3], [4], [6]])
  })

  it('requires a contact channel only for active or transactional accounts', async () => {
    const result = await runRule(8, [accountRow(2, { Phone: '', Email: '' }), accountRow(3, { Phone: '', Email: 'valid@example.test' }), accountRow(4, { Phone: '', Email: '', 'Account Status': 'Inactive', 'Account category': 'Prospect' })])
    expect(result.findings.map((finding) => finding.rowNumbers)).toEqual([[2]])
    expect(result.findings[0]?.fields).toEqual(['Phone', 'Email'])
  })

  it('checks identifiers independently across rows without treating blanks as duplicate IDs', async () => {
    const result = await runRule(9, [accountRow(2), accountRow(3, { 'Salesforce ID': '001abc' }), accountRow(4, { 'MDMi BPID': '', 'FNDG ID': '', 'Salesforce ID': '' }), accountRow(5, { 'MDMi BPID': '', 'FNDG ID': '', 'Salesforce ID': '' })])
    expect(result.findings.map((finding) => finding.fields[0]).sort()).toEqual(['FNDG ID', 'MDMi BPID'])
    expect(result.findings.every((finding) => JSON.stringify(finding.rowNumbers) === '[2,3]')).toBe(true)
  })

  it('checks exact normalized name and postcode matches without fuzzy matching or an address requirement', async () => {
    const result = await runRule(10, [accountRow(2), accountRow(3, { Name: '  Gréen   Seeds ', Address: '' }), accountRow(4, { Name: 'Green Seed' }), accountRow(5, { 'Postal code': '' })])
    expect(result.findings).toHaveLength(1)
    expect(result.findings[0]?.rowNumbers).toEqual([2, 3])
    expect(result.findings[0]?.fields).toEqual(['Name', 'Postal code'])
  })

  it('refuses unmodeled exceptions instead of running a partial condition', () => {
    const exception = compileRules(parseSourceRules(`${businessRules[0]!.sourceText} Except for dormant customers.`), businessProfile)
    expect(exception.canRun).toBe(false)
    expect(exception.compiledRules[0]?.plan).toBeNull()
  })
})
