import { describe, expect, it } from 'vitest'
import { generalLanguageCases } from '../benchmarks/generalLanguageCases'
import { ruleInputExamples } from '../benchmarks/ruleInputExamples'
import { analyzeDataset } from '../src/core/engine/analyze'
import { compileRules } from '../src/core/rules/compiler'
import { normalizeRuleRequest } from '../src/core/rules/requestLanguage'
import { parseSourceRules } from '../src/core/rules/source'
import { referenceDataset } from './business-rule-fixtures'

describe('general everyday rule language', () => {
  it('preserves the difference between requiring both fields and requiring either field', async () => {
    const dataset = referenceDataset('Input', [{ Phone: '', Email: 'email' }, { Phone: '', Email: '' }])
    const compilation = compileRules(parseSourceRules('"Phone" or "Email" must not be empty'), dataset.profile)
    expect(compilation.canRun).toBe(true)
    const result = await analyzeDataset({ projectId: 'alternatives', sessionId: 'alternatives', sheetName: 'Input', rows: dataset.rows, compilation })
    expect(result.findings.flatMap((finding) => finding.rowNumbers)).toEqual([3])
  })
  it.each(['Phone is required and Email is invalid', 'Do not require Phone', 'Don’t flag missing Phone', 'Please don’t require Phone', 'Check if Phone is empty and Name is duplicated', 'Check if columns "Phone" or "Email" exist'])('does not silently narrow mixed or negated requirements: %s', (source) => {
    const dataset = referenceDataset('Input', [{ Phone: '', Name: '', Email: '' }])
    expect(compileRules(parseSourceRules(source), dataset.profile).canRun).toBe(false)
  })

  it.each(['must be empty', 'unless', 'external reference table', 'do not flag'])('treats quoted text as data, not a command: %s', async (literal) => {
    const dataset = referenceDataset('Input', [{ Notes: literal }, { Notes: 'other text' }])
    const compilation = compileRules(parseSourceRules(`"Notes" must contain "${literal}"`), dataset.profile)
    expect(compilation.canRun).toBe(true)
    const result = await analyzeDataset({ projectId: 'literal', sessionId: 'literal', sheetName: 'Input', rows: dataset.rows, compilation })
    expect(result.findings.flatMap((finding) => finding.rowNumbers)).toEqual([3])
  })

  it.each([...generalLanguageCases, ...ruleInputExamples])('$text', async (test) => {
    const dataset = referenceDataset('Input', test.records)
    const compilation = compileRules(parseSourceRules(test.text), dataset.profile)
    if (test.blocked) {
      expect(compilation.canRun, test.text).toBe(false)
      return
    }
    expect(compilation.canRun, JSON.stringify(compilation.issues)).toBe(true)
    expect(compilation.interpretations[0]?.reference).toBeUndefined()
    const result = await analyzeDataset({ projectId: 'general-language', sessionId: 'general-language', sheetName: 'Input', rows: dataset.rows, compilation })
    expect([...new Set(result.findings.flatMap((finding) => finding.rowNumbers))].sort((left, right) => left - right)).toEqual(test.rows)
    expect(result.findings.filter((finding) => finding.scope === 'worksheet').flatMap((finding) => finding.fields)).toEqual(test.missingColumns ?? [])
  })

  it.each([
    'If "Status" is "Active", "Email" must have a value.',
    'Please ensure "Notes" must contain "must be empty  and obsolete".',
    'Verify "For Sales" has a value',
    '"Ship to" is not blank'
  ])('normalizes without repeated rewrites or literal changes: %s', (source) => {
    const normalized = normalizeRuleRequest(source).text
    expect(normalizeRuleRequest(normalized).text).toBe(normalized)
    expect(normalized.match(/"[^"]*"/gu)).toEqual(source.match(/"[^"]*"/gu))
  })

  it('reports absent columns for an empty worksheet without inventing source rows', async () => {
    const dataset = referenceDataset('Input', [])
    const compilation = compileRules(parseSourceRules('Check if the "VAT ID" column exists'), dataset.profile)
    expect(compilation.canRun).toBe(true)
    const result = await analyzeDataset({ projectId: 'empty', sessionId: 'empty', sheetName: 'Input', rows: [], compilation })
    expect(result.findings).toMatchObject([{ scope: 'worksheet', fields: ['VAT ID'], rowNumbers: [], evidence: [] }])
  })

  it.each(['Missing Owner', 'Empty field', 'State and Province'])('allows grammar words inside an explicitly quoted header: %s', async (header) => {
    const dataset = referenceDataset('Input', [{ Name: 'Alice' }])
    const compilation = compileRules(parseSourceRules(`Check if the "${header}" column exists`), dataset.profile)
    expect(compilation.canRun).toBe(true)
    const result = await analyzeDataset({ projectId: 'header', sessionId: 'header', sheetName: 'Input', rows: dataset.rows, compilation })
    expect(result.findings).toMatchObject([{ scope: 'worksheet', fields: [header], rowNumbers: [] }])
  })

  it('does not invent rows or empty-cell failures when a column exists but its values are blank', async () => {
    const dataset = referenceDataset('Input', [{ Phone: null }])
    const compilation = compileRules(parseSourceRules('Check if column Phone exists'), dataset.profile)
    const result = await analyzeDataset({ projectId: 'present', sessionId: 'present', sheetName: 'Input', rows: dataset.rows, compilation })
    expect(result.findings).toEqual([])
  })

  it('blocks an ambiguous column alias and stale confirmed mappings', () => {
    const dataset = referenceDataset('Input', [{ Telephone: '', 'Phone Number': '' }])
    const rules = parseSourceRules('Check if column Phone exists')
    expect(compileRules(rules, dataset.profile).canRun).toBe(false)
    expect(compileRules(rules, dataset.profile, { Phone: 'deleted-column' }).canRun).toBe(false)
  })
})
