import ExcelJS from 'exceljs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import { analyzeDataset } from '../src/core/engine/analyze'
import { compileInterpretations } from '../src/core/rules/compiler'
import { interpretRules } from '../src/core/rules/interpreter'
import { ruleMetadata } from '../src/core/rules/metadata'
import { applyLayaValidation, layaRuleInput, layaRuleQuestions } from '../src/core/rules/layaValidation'
import { parseSourceRules } from '../src/core/rules/source'
import { AnalysisService } from '../src/main/services/analysisService'
import type { WorkbookService } from '../src/main/services/workbookService'
import type { ProjectStore } from '../src/main/services/projectStore'
import { reviewedDatasetWorkbook, REVIEW_EXPORT_COLORS } from '../src/main/services/reviewedWorkbook'
import { RuleInterpretation } from '../src/renderer/src/features/rules/RuleInterpretation'
import { referenceDataset } from './business-rule-fixtures'
import { approvedLayaEntailment, mockLayaNlp } from './laya-fixtures'
import { workflowWorkbook } from './workflow-fixtures'

const action = 'Route it to the account’s current owner or the Data Steward to confirm the correct assignment.'
const sourceText = `Owner fields must identify the same person. If SFDC Veg Owner, Veg Owner Name, and Proposed Veg Owner FND ID identify different people, flag a medium- to high-priority ownership conflict. ${action} &#x20;`
const rules = parseSourceRules(sourceText)
const targets = ['SFDC Veg Owner', 'Veg Owner Name', 'Proposed Veg Owner FND ID']
const dataset = referenceDataset('Accounts', [
  { 'SFDC Veg Owner': 'Alice', 'Veg Owner Name': 'Alice', 'Proposed Veg Owner FND ID': 'Alice' },
  { 'SFDC Veg Owner': 'Alice', 'Veg Owner Name': 'Bob', 'Proposed Veg Owner FND ID': 'Alice' },
  { 'SFDC Veg Owner': 'Alice', 'Veg Owner Name': 'Alice', 'Proposed Veg Owner FND ID': '' },
  { 'SFDC Veg Owner': '', 'Veg Owner Name': null, 'Proposed Veg Owner FND ID': ' ' },
  { 'SFDC Veg Owner': ' Alice ', 'Veg Owner Name': 'Alice', 'Proposed Veg Owner FND ID': 'Alice' },
  { 'SFDC Veg Owner': 'alice.login', 'Veg Owner Name': 'Alice Smith', 'Proposed Veg Owner FND ID': 'OWNER-A' },
  { 'SFDC Veg Owner': 'Alice', 'Veg Owner Name': 'alice', 'Proposed Veg Owner FND ID': 'Alice' }
])

describe('owner field comparison follows the user-defined row equality rule', () => {
  it('gives Laya the author-defined equality semantics without bypassing negative or uncertain decisions', () => {
    const interpretation = interpretRules(rules, dataset.profile)[0]!
    expect(layaRuleInput(interpretation)).toMatchObject({ source_rule: rules[0]!.sourceText, comparison_policy: expect.stringContaining('within the same row') })
    expect(layaRuleQuestions(interpretation).validation?.instructions).toContain('proposed_check')
    for (const probability of [0.001, 0.79]) expect(applyLayaValidation(interpretation, approvedLayaEntailment(probability)).status).toBe('unsupported')
  })
  it('maps only the named inputs, Medium priority and exact action without inventing a reference', () => {
    const [interpretation] = interpretRules(rules, dataset.profile)
    expect(interpretation).toMatchObject({ status: 'valid', category: 'consistency', priority: 'medium', actionItem: action, businessCheck: { kind: 'same_fields', targets } })
    expect(interpretation?.fields.map((field) => field.columnKey)).toEqual(targets)
    expect(interpretation?.reference).toBeUndefined()
    expect(interpretation?.warnings).toEqual([])
    expect(compileInterpretations([interpretation!]).canRun).toBe(true)
  })

  it('flags any different values in the same row, including partial blanks and unlike name/ID values', async () => {
    const result = await analyzeDataset({ projectId: 'test', sessionId: 'test', sheetName: 'Accounts', rows: dataset.rows, compilation: compileInterpretations(interpretRules(rules, dataset.profile)) })
    expect(result.findings.flatMap((finding) => finding.rowNumbers)).toEqual([3, 4, 7, 8])
    expect(result.findings.every((finding) => finding.priority === 'medium' && finding.suggestedAction === action)).toBe(true)
    expect(result.findings.every((finding) => JSON.stringify(finding.fields) === JSON.stringify(targets))).toBe(true)
    expect(result.warnings).toEqual([])
    const workbook = reviewedDatasetWorkbook(dataset.profile.columns, dataset.rows, result.findings, [3])
    const reopened = new ExcelJS.Workbook()
    await reopened.xlsx.load(await workbook.xlsx.writeBuffer())
    const accepted = reopened.getWorksheet('Accepted rows')!.getRow(3)
    expect(accepted.getCell(4).value).toBe(action)
    expect(accepted.getCell(5).value).toBe('Medium')
    for (const column of [1, 2, 3]) expect(accepted.getCell(column).font.color?.argb).toBe(REVIEW_EXPORT_COLORS.errorText)
  })

  it('never reloads an obsolete reference configuration, even if it points to the source or a nonexistent sheet', async () => {
    for (const sheetName of ['Accounts', 'Removed Owners']) {
      const getWorksheetData = vi.fn().mockImplementation(async (_session, sheet) => {
        if (sheet !== 'Accounts') throw new Error('An external worksheet must not be read.')
        return dataset
      })
      const recordAnalysis = vi.fn()
      const service = new AnalysisService({ getWorksheetData } as unknown as WorkbookService, { recordAnalysis } as unknown as ProjectStore, mockLayaNlp())
      const input = { projectId: 'test', sessionId: 'test', sheetName: 'Accounts', rulesText: sourceText, disabledRuleIds: [], columnMappings: {}, ruleImpacts: {}, ruleConfigurations: { [rules[0]!.id]: { reference: { sheetName, columnMappings: {} } } } }
      expect((await service.preview(input)).canRun).toBe(true)
      expect((await service.run(input)).findings).toHaveLength(4)
      expect(getWorksheetData.mock.calls.every((call) => call[1] === 'Accounts')).toBe(true)
      expect(recordAnalysis).toHaveBeenCalledOnce()
    }
  })

  it('shows the three mappings, Medium and the action with no reference picker', () => {
    const markup = renderToStaticMarkup(createElement(RuleInterpretation, {
      interpretation: interpretRules(rules, dataset.profile)[0]!, index: 0, issues: [],
      workbook: { ...workflowWorkbook(), selectedSheet: dataset.profile }, mappings: {}, disabled: false,
      onMapping: () => undefined, onConfiguration: () => undefined
    }))
    expect(markup).not.toContain('Reference worksheet')
    expect(markup).not.toContain('owner directory')
    expect(markup).toContain('value="medium" selected=""')
    expect(markup).toContain('confirm the correct assignment.')
  })

  it('does not invent a third field when only two owner columns were requested', () => {
    const [interpretation] = interpretRules(parseSourceRules('SFDC Veg Owner and Veg Owner Name must match. Flag = medium. Action = Route to the Data Steward.'), dataset.profile)
    expect(interpretation?.fields.map((field) => field.token)).toEqual(targets.slice(0, 2))
    expect(interpretation?.priority).toBe('medium')
    expect(interpretation?.actionItem).toBe('Route to the Data Steward.')
    expect(interpretation?.reference).toBeUndefined()
  })

  it('requires distinct source columns and preserves explicit priority overrides', () => {
    const compilation = compileInterpretations(interpretRules(rules, dataset.profile, { 'Veg Owner Name': 'SFDC Veg Owner' }))
    expect(compilation.canRun).toBe(false)
    expect(compilation.issues[0]?.message).toContain('different source column')
    expect(ruleMetadata(sourceText, { priority: 'high' }).priority).toBe('high')
    expect(ruleMetadata('Flag = medium. Action = Confirm assignment.')).toMatchObject({ priority: 'medium', actionItem: 'Confirm assignment.' })
    expect(ruleMetadata('Priority: Medium / High. Action: Confirm assignment.').priority).toBe('medium_high')
  })
})
