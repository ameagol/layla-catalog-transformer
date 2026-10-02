import type { SystemOneResult } from 'laya-ts'
import { describe, expect, it, vi } from 'vitest'

import { compileInterpretations } from '../src/core/rules/compiler'
import { interpretRules } from '../src/core/rules/interpreter'
import { applyLayaValidation, layaRuleInput, layaRuleQuestions } from '../src/core/rules/layaValidation'
import { NlpService } from '../src/main/services/nlpService'
import { approvedLayaEntailment, approvedLayaResult } from './laya-fixtures'
import { businessContext, businessProfile, businessRules } from './business-rule-fixtures'

const request = { rules: [businessRules[0]!], profile: businessProfile, columnMappings: {}, ...businessContext }
const candidate = interpretRules(request.rules, request.profile, request.columnMappings, request)[0]!

describe('mandatory business intent approval', () => {
  it('passes the complete original rule and proposed detection intent to real inference', async () => {
    const predict = vi.fn().mockResolvedValue(approvedLayaEntailment())
    const [interpretation] = await new NlpService({ predict }).interpret(request)
    expect(layaRuleInput(candidate)).toMatchObject({ source_rule: businessRules[0]!.sourceText, proposed_check: expect.stringContaining('SFDC Veg Owner') })
    expect(predict).toHaveBeenCalledWith(layaRuleInput(candidate), layaRuleQuestions(candidate), { lang: 'en', minConfidence: 0.8 })
    expect(interpretation).toMatchObject({ status: 'valid', aiValidation: { decision: 'approved', method: 'intent_entailment' } })
  })

  const blocked: Array<[string, SystemOneResult]> = [
    ['confident negative', approvedLayaEntailment(0.001, 0.999)],
    ['low positive probability despite confidence', approvedLayaEntailment(0.79, 0.99)],
    ['low confidence', approvedLayaEntailment(0.95, 0.7)],
    ['invalid probability', approvedLayaEntailment(Number.NaN, 0.99)],
    ['out-of-range probability', approvedLayaEntailment(1.1, 0.99)],
    ['invalid confidence', approvedLayaEntailment(0.99, Number.POSITIVE_INFINITY)],
    ['wrong answer type', approvedLayaResult('missing')],
    ['absent answer', { ...approvedLayaEntailment(), answers: {} }],
    ['truncated input', { ...approvedLayaEntailment(), usage: { input_tokens: 100, output_tokens: 0, truncated: true } }],
    ['truncated question', { ...approvedLayaEntailment(), usage: { input_tokens: 100, output_tokens: 0, truncated: false, truncated_questions: ['validation'] } }],
    ['dropped state tokens', { ...approvedLayaEntailment(), usage: { input_tokens: 100, output_tokens: 0, truncated: false, state_tokens_dropped: 1 } }]
  ]
  it.each(blocked)('blocks %s without bypass or fallback', (_label, prediction) => {
    const interpretation = applyLayaValidation(candidate, prediction)
    expect(interpretation.aiValidation?.decision).toBe('needs_review')
    expect(compileInterpretations([interpretation]).canRun).toBe(false)
  })

  it('honors the low-confidence flag even when both probabilities are high', () => {
    const prediction = approvedLayaEntailment()
    prediction.answers.validation!.low_confidence = true
    expect(applyLayaValidation(candidate, prediction).aiValidation?.decision).toBe('needs_review')
  })

  it('approves a simple missing-field condition without inventing a reference sheet', async () => {
    const [interpretation] = await new NlpService({ predict: vi.fn().mockResolvedValue(approvedLayaEntailment()) }).interpret({ ...request, rules: [businessRules[1]!], ruleConfigurations: {} })
    expect(interpretation).toMatchObject({ status: 'valid', aiValidation: { decision: 'approved' }, businessCheck: { kind: 'required' } })
    expect(interpretation?.reference).toBeUndefined()
    expect(compileInterpretations([interpretation!]).canRun).toBe(true)
  })

  it('never treats AI approval as permission to invent inline scope values', async () => {
    const [interpretation] = await new NlpService({ predict: vi.fn().mockResolvedValue(approvedLayaEntailment()) }).interpret({ ...request, rules: [businessRules[5]!], ruleConfigurations: {} })
    expect(interpretation?.status).toBe('needs_configuration')
    expect(interpretation?.reference).toBeUndefined()
    expect(compileInterpretations([interpretation!]).canRun).toBe(false)
  })
})
