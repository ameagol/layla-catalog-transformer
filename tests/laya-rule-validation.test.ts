import { describe, expect, it, vi } from 'vitest'

import { interpretRule, interpretRules } from '../src/core/rules/interpreter'
import { applyLayaValidation, layaRuleQuestions } from '../src/core/rules/layaValidation'
import { parseSourceRules } from '../src/core/rules/source'
import { AnalysisService } from '../src/main/services/analysisService'
import { LayaService } from '../src/main/services/layaService'
import { NlpService } from '../src/main/services/nlpService'
import type { ProjectStore } from '../src/main/services/projectStore'
import type { WorkbookService } from '../src/main/services/workbookService'
import { approvedLayaResult } from './laya-fixtures'
import { workflowWorkbook } from './workflow-fixtures'

const sourceText = 'Flag rows with a missing email.'
const request = { rules: parseSourceRules(sourceText), profile: workflowWorkbook().selectedSheet, columnMappings: {} }

describe('required Laya rule validation', () => {
  it('executes an AI prediction for every enabled rule, keeping original text and resolved mappings', async () => {
    const predict = vi.fn().mockResolvedValue(approvedLayaResult())
    const service = new NlpService({ predict })
    const rules = parseSourceRules(`${sourceText}\n\nFlag rows with a missing phone.`)
    const result = await service.interpret({ ...request, rules })
    expect(predict).toHaveBeenCalledTimes(2)
    expect(predict).toHaveBeenCalledWith(sourceText, expect.objectContaining({ validation: expect.objectContaining({ type: 'choice' }) }), { lang: 'en', minConfidence: 0.8 })
    expect(result.map((interpretation) => interpretation.aiValidation?.decision)).toEqual(['approved', 'approved'])
    expect(result[0]).toMatchObject({ sourceText, status: 'valid', fields: [expect.objectContaining({ columnKey: 'email' })] })
    expect(JSON.stringify(predict.mock.calls)).not.toContain('quality.xlsx')
  })

  it('does not invoke AI for disabled or absent rules', async () => {
    const predict = vi.fn().mockResolvedValue(approvedLayaResult())
    const service = new NlpService({ predict })
    expect(await service.interpret({ ...request, rules: [{ ...request.rules[0]!, enabled: false }] })).toEqual([])
    expect(await service.interpret({ ...request, rules: [] })).toEqual([])
    expect(predict).not.toHaveBeenCalled()
  })

  it.each([
    ['different category', { ...approvedLayaResult('duplicate') }],
    ['low confidence', { ...approvedLayaResult('missing', 0.79) }],
    ['unknown choice', { ...approvedLayaResult('invented') }],
    ['missing decision', { ...approvedLayaResult(), answers: {} }],
    ['truncated rule', { ...approvedLayaResult(), usage: { input_tokens: 1024, output_tokens: 0, truncated: true } }],
    ['invalid confidence', { ...approvedLayaResult('missing', Number.NaN) }]
  ])('blocks %s instead of falling back to the deterministic proposal', async (_label, result) => {
    const service = new NlpService({ predict: vi.fn().mockResolvedValue(result) })
    const [interpretation] = await service.interpret(request)
    expect(interpretation).toMatchObject({ status: 'unsupported', aiValidation: { decision: 'needs_review' } })
  })

  it('fails explicitly when AI is unavailable and retries on the next validation', async () => {
    const predict = vi.fn().mockRejectedValueOnce(new Error('Laya unavailable')).mockResolvedValueOnce(approvedLayaResult())
    const service = new NlpService({ predict })
    await expect(service.interpret(request)).rejects.toThrow('Laya unavailable')
    expect((await service.interpret(request))[0]?.aiValidation?.decision).toBe('approved')
  })

  it('never lets an AI approval bypass unsupported conditions or negated commands', () => {
    for (const text of ['Flag email when missing for corporate customers only.', 'Do not flag missing email values.', 'Predict future demand with magic.']) {
      const candidate = interpretRule(parseSourceRules(text)[0]!, request.profile)
      expect(layaRuleQuestions(candidate).validation?.criteria).toHaveProperty('unsupported')
      expect(applyLayaValidation(candidate, approvedLayaResult(candidate.category)).status).toBe('unsupported')
    }
  })

  it('still requires column confirmation even if Laya approves the intent', async () => {
    const service = new NlpService({ predict: vi.fn().mockResolvedValue(approvedLayaResult()) })
    const [interpretation] = await service.interpret({ ...request, profile: undefined })
    expect(interpretation).toMatchObject({ status: 'needs_mapping', aiValidation: { decision: 'approved' } })
  })

  it('reports unavailable local files without downloading a model or making an external request', async () => {
    const runtime = new LayaService('C:\\catalog-model-does-not-exist')
    await expect(runtime.ready()).rejects.toThrow('cannot fall back')
  })
})

describe('analysis requires AI approval', () => {
  const input = { projectId: '00000000-0000-4000-8000-000000000121', sessionId: workflowWorkbook().sessionId, sheetName: 'Customers', rulesText: sourceText, disabledRuleIds: [], columnMappings: {} }
  const workbooks = { getWorksheetData: async () => ({ profile: request.profile, rows: [{ rowNumber: 2, values: { email: '' } }] }) } as unknown as WorkbookService

  it('rejects an interpreter that returns deterministic-only plans with no AI decision', async () => {
    const projects = { recordAnalysis: vi.fn() } as unknown as ProjectStore
    const service = new AnalysisService(workbooks, projects, { interpret: async (request) => interpretRules(request.rules, request.profile, request.columnMappings) })
    expect((await service.preview(input)).canRun).toBe(false)
    await expect(service.run(input)).rejects.toThrow('Laya AI approval')
    expect(projects.recordAnalysis).not.toHaveBeenCalled()
  })

  it('rejects omitted enabled rules instead of running a partial review', async () => {
    const service = new AnalysisService(workbooks, {} as ProjectStore, { interpret: async () => [] })
    await expect(service.preview(input)).rejects.toThrow('every enabled rule')
  })

  it('blocks the whole run if any enabled rule has uncertain AI approval', async () => {
    const predict = vi.fn().mockResolvedValueOnce(approvedLayaResult()).mockResolvedValueOnce(approvedLayaResult('needs_review'))
    const service = new AnalysisService(workbooks, {} as ProjectStore, new NlpService({ predict }))
    const compilation = await service.preview({ ...input, rulesText: `${sourceText}\n\nFlag rows with a missing phone.` })
    expect(compilation.canRun).toBe(false)
    expect(compilation.provider).toBe('laya')
    expect(compilation.issues.length).toBeGreaterThan(0)
  })
})
