import type { RuleInterpretation, RuleInterpretationRequest } from '@core/model/domain'
import { interpretRules } from '@core/rules/interpreter'
import { applyLayaValidation, LAYA_RULE_CONFIDENCE, layaRuleInput, layaRuleQuestions } from '@core/rules/layaValidation'

import type { LayaPredictor } from './layaService'

export class NlpService {
  constructor(private readonly laya: LayaPredictor) {}

  async interpret(request: RuleInterpretationRequest): Promise<RuleInterpretation[]> {
    const candidates = interpretRules(request.rules, request.profile, request.columnMappings, request)
    const reviewed: RuleInterpretation[] = []
    for (const candidate of candidates) {
      const result = await this.laya.predict(layaRuleInput(candidate), layaRuleQuestions(candidate), { lang: 'en', minConfidence: LAYA_RULE_CONFIDENCE })
      reviewed.push(applyLayaValidation(candidate, result))
    }
    return reviewed
  }

  async testProvider(): Promise<{ ok: boolean; message: string; latencyMs?: number }> {
    const startedAt = performance.now()
    try {
      const interpretations = await this.interpret({
        rules: [{ id: 'provider-test-rule', sourceText: 'Flag rows with a missing email.', enabled: true, order: 0 }],
        columnMappings: {}
      })
      const approved = interpretations[0]?.aiValidation?.decision === 'approved'
      return {
        ok: approved,
        message: approved ? 'Laya AI executed a real rule-intent validation.' : 'Laya AI requires review of the test rule.',
        latencyMs: Math.round(performance.now() - startedAt)
      }
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : 'Laya AI validation failed.' }
    }
  }
}
