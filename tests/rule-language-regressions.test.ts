import { describe, expect, it, vi } from 'vitest'

import { analyzeDataset } from '../src/core/engine/analyze'
import { compileInterpretations, compileRules } from '../src/core/rules/compiler'
import { parseSourceRules } from '../src/core/rules/source'
import { NlpService } from '../src/main/services/nlpService'
import { createCustomerProfile } from './fixtures'
import { approvedLayaResult } from './laya-fixtures'
import { reportedRules, ruleLanguageRows } from './rule-language-fixtures'

const profile = createCustomerProfile(ruleLanguageRows)

describe('plain-language duplicate and missing rules', () => {
  it.each([
    [reportedRules[0], 'duplicate', 'name'],
    [reportedRules[1], 'duplicate', 'phone'],
    [reportedRules[2], 'missing', 'name']
  ])('compiles the reported wording: %s', (text, category, columnKey) => {
    const result = compileRules(parseSourceRules(text), profile)
    expect(result.issues).toEqual([])
    expect(result.canRun).toBe(true)
    expect(result.interpretations[0]).toMatchObject({ category, status: 'valid', fields: [expect.objectContaining({ columnKey })] })
    expect(result.compiledRules[0]?.plan?.kind).toBe(category)
  })

  it.each([
    'Find duplicates with the same phone in different formatting.',
    'Identify duplicated phones with the same number in different phone formats.',
    'Identify duplicated names with the same name in different capitalization.'
  ])('does not interpret presentation differences as conflicting field values: %s', (text) => {
    const result = compileRules(parseSourceRules(text), profile)
    expect(result.issues).toEqual([])
    expect(result.compiledRules[0]?.plan?.kind).toBe('duplicate')
  })

  it.each([
    'Check for missing emails.',
    'Look for empty names.',
    'Search for missing phone numbers.',
    'Scan for empty names.',
    'Check for blank names.',
    'For each row, check for empty names.'
  ])('recognizes an unscoped missing-value request: %s', (text) => {
    const result = compileRules(parseSourceRules(text), profile)
    expect(result.issues).toEqual([])
    expect(result.compiledRules[0]?.plan?.kind).toBe('missing')
  })

  it.each([
    'Check for empty names for corporate customers only.',
    'Check for empty names if phone is empty.',
    'Check for empty names where email is present.',
    'Name is required for each row if email is empty.',
    'Name is required for each corporate customer.'
  ])('still refuses to approximate a scoped requirement: %s', (text) => {
    const result = compileRules(parseSourceRules(text), profile)
    expect(result.canRun).toBe(false)
    expect(result.interpretations[0]?.status).toBe('unsupported')
    expect(result.issues[0]?.code).toBe('UNSUPPORTED_RULE')
    expect(result.compiledRules[0]?.plan).toBeNull()
  })

  it.each([
    'The same CPF must not be associated with different names.',
    'The same CPF must not be associated with different names, ignoring different formats.'
  ])('preserves genuine consistency rules: %s', (text) => {
    const result = compileRules(parseSourceRules(text), profile)
    expect(result.issues).toEqual([])
    expect(result.compiledRules[0]?.plan).toMatchObject({ kind: 'consistency', keyField: { columnKey: 'cpf' }, dependentField: { columnKey: 'name' } })
  })

  it('compares formatted phones by canonical number without discarding the area code', () => {
    const result = compileRules(parseSourceRules(reportedRules[1]), profile)
    expect(result.interpretations[0]?.normalizations).toContain('phone_br')
    expect(result.compiledRules[0]?.plan).toMatchObject({ kind: 'duplicate', matchers: [expect.objectContaining({ normalizations: ['phone_br'] })] })
  })

  it('requires AI approval for the exact original instructions and executes all three checks', async () => {
    const predict = vi.fn()
      .mockResolvedValueOnce(approvedLayaResult('duplicate'))
      .mockResolvedValueOnce(approvedLayaResult('duplicate'))
      .mockResolvedValueOnce(approvedLayaResult('missing'))
    const service = new NlpService({ predict })
    const rules = parseSourceRules(reportedRules.map((text) => `- ${text}`).join('\n'))
    const interpretations = await service.interpret({ rules, profile, columnMappings: {} })
    expect(predict.mock.calls.map((call) => call[0])).toEqual(reportedRules)
    expect(interpretations.map((interpretation) => interpretation.aiValidation?.decision)).toEqual(['approved', 'approved', 'approved'])
    const compilation = compileInterpretations(interpretations)
    expect(compilation.issues).toEqual([])
    const analysis = await analyzeDataset({
      projectId: '00000000-0000-4000-8000-000000000001',
      sessionId: '00000000-0000-4000-8000-000000000002',
      sheetName: profile.name,
      rows: ruleLanguageRows,
      compilation
    })
    expect(analysis.rulesExecuted).toBe(3)
    expect(analysis.findings.filter((finding) => finding.ruleId === rules[0]!.id).map((finding) => finding.rowNumbers)).toEqual([[2, 3]])
    const phone = analysis.findings.find((finding) => finding.ruleId === rules[1]!.id)
    expect(phone?.rowNumbers).toEqual([2, 3, 4])
    expect(new Set(phone?.evidence.map((evidence) => evidence.normalizedValue))).toEqual(new Set(['1990901010']))
    expect(analysis.findings.filter((finding) => finding.ruleId === rules[2]!.id).flatMap((finding) => finding.rowNumbers)).toEqual([5, 6, 7])
    expect(analysis.findings.some((finding) => finding.rowNumbers.includes(8) || finding.rowNumbers.includes(9))).toBe(false)
  })
})
