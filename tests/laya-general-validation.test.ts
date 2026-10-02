import { describe, expect, it, vi } from 'vitest'
import { generalLanguageCases } from '../benchmarks/generalLanguageCases'
import { interpretRules } from '../src/core/rules/interpreter'
import { applyLayaValidation, layaRuleInput, layaRuleQuestions } from '../src/core/rules/layaValidation'
import { parseSourceRules } from '../src/core/rules/source'
import { NlpService } from '../src/main/services/nlpService'
import { referenceDataset } from './business-rule-fixtures'
import { approvedLayaEntailment, approvedLayaResult } from './laya-fixtures'

describe('general-rule AI approval contract', () => {
  it.each(generalLanguageCases.filter((test) => !test.blocked))('validates the original instruction, not only rewritten text: $text', async (test) => {
    const dataset = referenceDataset('Input', test.records)
    const rules = parseSourceRules(test.text)
    const candidate = interpretRules(rules, dataset.profile)[0]!
    const question = layaRuleQuestions(candidate).validation!
    const predict = vi.fn().mockResolvedValue(question.type === 'noul' ? approvedLayaEntailment() : approvedLayaResult(Object.keys(question.criteria as Record<string, string>)[0]!))
    const [interpretation] = await new NlpService({ predict }).interpret({ rules, profile: dataset.profile, columnMappings: {} })
    expect(predict).toHaveBeenCalledTimes(1)
    expect(predict).toHaveBeenCalledWith(layaRuleInput(candidate), layaRuleQuestions(candidate), { lang: 'en', minConfidence: 0.8 })
    const input = predict.mock.calls[0]![0] as ReturnType<typeof layaRuleInput>
    expect(typeof input === 'string' ? input : input.source_rule).toBe(rules[0]!.sourceText)
    expect(interpretation?.aiValidation?.decision).toBe('approved')
    expect(applyLayaValidation(candidate, approvedLayaResult('unrelated', 0.99)).aiValidation?.decision).toBe('needs_review')
    expect(applyLayaValidation(candidate, approvedLayaEntailment(0.001, 0.999)).aiValidation?.decision).toBe('needs_review')
  })
})
