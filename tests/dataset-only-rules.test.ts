import ExcelJS from 'exceljs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type { CellValue, DatasetRow } from '../src/core/model/domain'
import { analyzeDataset } from '../src/core/engine/analyze'
import { consolidateFindings } from '../src/core/findings/consolidate'
import { compileInterpretations } from '../src/core/rules/compiler'
import { interpretRules } from '../src/core/rules/interpreter'
import { parseSourceRules } from '../src/core/rules/source'
import { ruleDetectionText } from '../src/core/rules/metadata'
import { AnalysisService } from '../src/main/services/analysisService'
import type { WorkbookService } from '../src/main/services/workbookService'
import type { ProjectStore } from '../src/main/services/projectStore'
import { reviewedDatasetWorkbook, REVIEW_EXPORT_COLORS } from '../src/main/services/reviewedWorkbook'
import { RuleInterpretation } from '../src/renderer/src/features/rules/RuleInterpretation'
import { parseConditionValues } from '../src/renderer/src/features/rules/helper'
import { accountRow, businessContext, businessProfile, businessRules, businessRuleText, referenceDataset } from './business-rule-fixtures'
import { mockLayaNlp } from './laya-fixtures'
import { workflowWorkbook } from './workflow-fixtures'

async function runText(source: string, records: Record<string, CellValue>[]) {
  const dataset = referenceDataset('Input', records)
  const compilation = compileInterpretations(interpretRules(parseSourceRules(source), dataset.profile))
  expect(compilation.canRun, JSON.stringify(compilation.issues)).toBe(true)
  expect(compilation.interpretations.every((rule) => !rule.reference)).toBe(true)
  return analyzeDataset({ projectId: 'test', sessionId: 'test', sheetName: 'Input', rows: dataset.rows, compilation })
}

describe('dataset-only rules and four-part rule input', () => {
  it.each([':', '=', '-'])('separates Title, Rule, Flag and Action with %s labels', (separator) => {
    const text = `TITLE ${separator} The proposed owner must be identifiable.\nRULE ${separator} If the Proposed Veg Owner FND ID is blank\nFLAG ${separator} high-priority\nACTION ${separator} route it to the Data Steward for owner master-data correction. &#x20;`
    const rules = parseSourceRules(text)
    expect(rules).toHaveLength(1)
    const [rule] = interpretRules(rules, businessProfile)
    expect(rule).toMatchObject({ status: 'valid', title: 'The proposed owner must be identifiable.', priority: 'high', actionItem: 'route it to the Data Steward for owner master-data correction.', businessCheck: { kind: 'required', targets: ['Proposed Veg Owner FND ID'] } })
    expect(ruleDetectionText(rules[0]!.sourceText)).toBe('If the Proposed Veg Owner FND ID is blank')
  })

  it('groups multiple labeled rules without blank lines and ignores title/action field names', () => {
    const text = 'Title: Email and Phone consistency.\nRule: If Proposed Veg Owner FND ID is blank\nFlag: high\nAction: Route to Email Operations.\nTitle: Sales structure.\nRule: If Current Owner is blank\nFlag: medium\nAction: Route to Phone Operations.'
    const rules = parseSourceRules(text)
    expect(rules).toHaveLength(2)
    const result = interpretRules(rules, businessProfile)
    expect(result.map((rule) => rule.fields.map((field) => field.columnHeader))).toEqual([['Proposed Veg Owner FND ID'], ['SFDC Veg Owner']])
  })

  it.each([
    'If "Status" = "Active", "Email" cannot be empty.',
    'If Status equals Active and Email is blank.',
    'If "Status" is "Active", "Email" must have a value.',
    'When "Status" = "Active", "Email" can’t be empty.'
  ])('executes conditional missing checks: %s', async (source) => {
    const result = await runText(`${source} Flag: medium. Action: Supply the email.`, [
      { Status: 'Active', Email: '' }, { Status: 'Inactive', Email: '' }, { Status: 'Active', Email: 'present@example.test' }
    ])
    expect(result.findings.map((finding) => finding.rowNumbers)).toEqual([[2]])
    expect(result.findings[0]?.fields).toEqual(['Email'])
    expect(result.findings[0]?.suggestedAction).toBe('Supply the email.')
  })

  it('respects compound AND and OR conditions without flagging unrelated rows', async () => {
    const records = [{ Status: 'Active', Country: 'US', Email: '' }, { Status: 'Inactive', Country: 'US', Email: '' }, { Status: 'Active', Country: 'CA', Email: '' }, { Status: 'Inactive', Country: 'CA', Email: '' }]
    expect((await runText('If "Status" = "Active" and "Country" = "US", "Email" is required.', records)).findings.map((finding) => finding.rowNumbers)).toEqual([[2]])
    expect((await runText('If "Status" = "Active" or "Country" = "US", "Email" is required.', records)).findings.map((finding) => finding.rowNumbers)).toEqual([[2], [3], [4]])
  })

  it('supports inline allowed scope values without inferring them from the dataset', async () => {
    const result = await runText('If "Account Type" is one of "SME", "Grower", "Segmentation" must not be blank.', [{ 'Account Type': 'SME', Segmentation: '' }, { 'Account Type': 'Grower', Segmentation: null }, { 'Account Type': 'Other', Segmentation: '' }])
    expect(result.findings.map((finding) => finding.rowNumbers)).toEqual([[2], [3]])
  })

  it('treats zero and false as present values and distinguishes both-blank from either-blank', async () => {
    const result = await runText('"Value" is required.', [{ Value: 0 }, { Value: false }, { Value: ' ' }, { Value: null }])
    expect(result.findings.map((finding) => finding.rowNumbers)).toEqual([[4], [5]])
    const contacts = [{ Phone: '', Email: '' }, { Phone: '', Email: 'ok@example.test' }]
    expect((await runText('Flag rows where both "Phone" and "Email" are blank.', contacts)).findings).toHaveLength(1)
    expect((await runText('If "Phone" is blank or "Email" is blank.', contacts)).findings).toHaveLength(2)
  })

  it('checks only the named text fragment and preserves literal punctuation', async () => {
    const result = await runText('Product Code must contain "A.B". Flag: low. Action: Correct the code.', [{ 'Product Code': 'SKU-A.B-1' }, { 'Product Code': 'SKU-AXB-1' }, { 'Product Code': '' }])
    expect(result.findings.map((finding) => finding.rowNumbers)).toEqual([[3], [4]])
  })

  it('checks invalid email locally and leaves missing email to a required-value rule', async () => {
    const result = await runText('Email must be a valid email address.', [{ Email: 'valid@example.test' }, { Email: 'no-at-sign' }, { Email: 'bad@@example.test' }, { Email: '' }])
    expect(result.findings.map((finding) => finding.rowNumbers)).toEqual([[3], [4]])
  })

  it('preserves the existing validation path for standalone legacy phone and email wording', () => {
    for (const source of ['Phone is required.', 'Email must be a valid email address.']) {
      const [rule] = interpretRules(parseSourceRules(source), businessProfile)
      expect(rule?.status).toBe('valid')
      expect(rule?.businessCheck).toBeUndefined()
      expect(rule?.reference).toBeUndefined()
    }
  })

  it.each(['ZIP must be valid.', 'Find invalid ZIP codes.', 'Flag rows where ZIP is invalid.'])('supports short local format requests: %s', async (source) => {
    const result = await runText(source, [{ ZIP: '00501' }, { ZIP: '12A45' }])
    expect(result.findings.map((finding) => finding.rowNumbers)).toEqual([[3]])
  })

  it.each([
    ['Flag rows where "Notes" contains "obsolete".', [2]],
    ['If Notes does not contain "obsolete".', [3]],
    ['Flag rows where Notes starts with "obsolete".', [2]]
  ] as const)('supports detection of specific text fragments: %s', async (source, expected) => {
    const result = await runText(source, [{ Notes: 'obsolete item' }, { Notes: 'current item' }])
    expect(result.findings.flatMap((finding) => finding.rowNumbers)).toEqual(expected)
  })

  it('does not silently invent geographic formats or execute reference-based rules', () => {
    for (const source of ['US postal codes must match ZIP format and apply country-specific formats for other countries.', 'Proposed Veg Owner FND ID must be present in the owner directory.']) {
      const compilation = compileInterpretations(interpretRules(parseSourceRules(source), businessProfile))
      expect(compilation.canRun).toBe(false)
      expect(compilation.interpretations.every((rule) => !rule.reference)).toBe(true)
      expect(compilation.issues.every((issue) => !issue.message.includes('Select a reference'))).toBe(true)
    }
  })

  it('renders dataset-only mappings and an inline condition editor instead of a reference picker', () => {
    const interpretations = interpretRules(businessRules, businessProfile, {}, businessContext)
    const markup = interpretations.map((interpretation, index) => renderToStaticMarkup(createElement(RuleInterpretation, {
      interpretation, index, issues: [], workbook: { ...workflowWorkbook(), selectedSheet: businessProfile }, mappings: {}, disabled: false,
      configuration: businessContext.ruleConfigurations[interpretation.id], onMapping: () => undefined, onConfiguration: () => undefined
    }))).join('')
    expect(markup).not.toContain('Reference worksheet')
    expect(markup).not.toContain('Select a reference')
    expect(markup).toContain('Condition values for Account Type')
    expect(parseConditionValues('Grower, SME; Grower\nDistributor')).toEqual(['Grower', 'SME', 'Distributor'])
  })

  it('never reads another sheet even when every saved rule has a stale reference setting', async () => {
    const rows = [accountRow(2)]
    const getWorksheetData = vi.fn().mockImplementation(async (_session, sheet) => {
      if (sheet !== 'Accounts') throw new Error('External sheets must not be loaded.')
      return { profile: businessProfile, rows }
    })
    const service = new AnalysisService({ getWorksheetData } as unknown as WorkbookService, { recordAnalysis: vi.fn() } as unknown as ProjectStore, mockLayaNlp())
    const ruleConfigurations = Object.fromEntries(businessRules.map((rule) => [rule.id, { ...businessContext.ruleConfigurations[rule.id], reference: { sheetName: 'Deleted reference', columnMappings: {} } }]))
    const input = { projectId: 'test', sessionId: 'test', sheetName: 'Accounts', rulesText: businessRuleText, disabledRuleIds: [], columnMappings: {}, ruleImpacts: {}, ruleConfigurations }
    expect((await service.preview(input)).canRun).toBe(true)
    expect((await service.run(input)).findings).toEqual([])
    expect(getWorksheetData.mock.calls.every((call) => call[1] === 'Accounts')).toBe(true)
  })

  it('consolidates deviations and exports accepted rows, action items and red error cells', async () => {
    const rows: DatasetRow[] = [accountRow(2, { 'Proposed Veg Owner FND ID': '', State: 'ZZ', 'Postal code': 'bad' }), accountRow(3, { State: 'ZZ' }), accountRow(4)]
    const selected = [businessRules[1]!, businessRules[6]!, businessRules[7]!]
    const result = await analyzeDataset({ projectId: 'test', sessionId: 'test', sheetName: 'Accounts', rows, compilation: compileInterpretations(interpretRules(selected, businessProfile)) })
    expect(consolidateFindings(result.findings)).toHaveLength(2)
    const workbook = reviewedDatasetWorkbook(businessProfile.columns, rows, result.findings, [2])
    const reopened = new ExcelJS.Workbook()
    await reopened.xlsx.load(await workbook.xlsx.writeBuffer())
    const sheet = reopened.getWorksheet('Accepted rows')!
    expect(sheet.rowCount).toBe(3)
    for (const field of ['Proposed Veg Owner FND ID', 'State', 'Postal code']) {
      const column = businessProfile.columns.findIndex((candidate) => candidate.header === field) + 1
      expect(sheet.getRow(2).getCell(column).font.color?.argb).toBe(REVIEW_EXPORT_COLORS.errorText)
    }
    expect(String(sheet.getRow(2).getCell(businessProfile.columns.length + 1).value)).toContain('owner master-data correction')
    expect(String(sheet.getRow(2).getCell(businessProfile.columns.length + 1).value)).toContain('correct the address data')
  })
})
