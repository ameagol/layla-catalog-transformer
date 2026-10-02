import type { QuestionDef, SystemOneResult } from 'laya-ts'

import type { RuleCategory, RuleInterpretation } from '../model/domain'
import { layaBusinessIntent } from './layaBusinessIntent'
import { ruleDetectionText } from './metadata'
import { atomicLayaApproval } from './layaAtomicIntent'
import { withoutLiterals } from './requestLanguage'

export const LAYA_RULE_CONFIDENCE = 0.8
export const LAYA_MODEL = 'convaiinnovations/laya/multilingual'

const OPERATIONS: Record<RuleCategory, string> = {
  duplicate: 'Find records with the same combination of field values.',
  missing: 'Find missing required values.',
  validation: 'Check a value against a format, type, checksum or allowed phone area code.',
  uniqueness: 'Require each value of a field to be unique across records.',
  consistency: 'Require records with the same identifier to agree on another field.',
  normalization: 'Ignore presentation differences when comparing values.',
  similarity: 'Find possible duplicate records by approximate text similarity.'
}

function unsupportedIntent(interpretation: RuleInterpretation): boolean {
  return interpretation.status === 'unsupported' || /\b(do not|don't|never)\s+(flag|detect|check|validate|report|find)\b/iu.test(withoutLiterals(interpretation.sourceText))
}

export function layaRuleQuestions(interpretation: RuleInterpretation): Record<string, QuestionDef> {
  const atomic = !unsupportedIntent(interpretation) ? atomicLayaApproval(interpretation) : undefined
  if (atomic) return { validation: atomic.question }
  if (interpretation.businessCheck && !unsupportedIntent(interpretation)) {
    return { validation: { type: 'noul', instructions: 'Does `proposed_check` correctly describe the data-quality detection intent of `source_rule`?' } }
  }
  const category = unsupportedIntent(interpretation) ? 'unsupported' : interpretation.category
  return {
    validation: {
      type: 'choice',
      instructions: 'What does this data-quality rule ask us to do? Select the matching operation or choose needs_review.',
      criteria: {
        [category]: category === 'unsupported'
          ? 'Unclear request, conditional or negated rule, prediction, action, or another unsupported operation.'
          : OPERATIONS[category],
        needs_review: 'A different operation, unclear request, unsupported condition or request that needs human review.'
      }
    }
  }
}

export function layaRuleInput(interpretation: RuleInterpretation): string | { source_rule: string; proposed_check: string; comparison_policy?: string; condition_values?: unknown } {
  const atomic = !unsupportedIntent(interpretation) ? atomicLayaApproval(interpretation) : undefined
  if (atomic) return atomic.input
  return interpretation.businessCheck && !unsupportedIntent(interpretation)
    ? { source_rule: interpretation.businessCheck.kind === 'format' && interpretation.businessCheck.format === 'us_state' ? ruleDetectionText(interpretation.sourceText) : interpretation.sourceText,
      ...(interpretation.businessCheck.kind === 'same_fields' ? { comparison_policy: 'Same person means equal cell values within the same row.' } : {}),
      ...(interpretation.businessCheck.kind === 'required' && interpretation.businessCheck.configurableScope ? { condition_values: interpretation.businessCheck.when } : {}),
      proposed_check: layaBusinessIntent(interpretation.businessCheck) }
    : interpretation.sourceText
}

export function applyLayaValidation(interpretation: RuleInterpretation, result: SystemOneResult): RuleInterpretation {
  const answer = result.answers.validation
  const atomic = !unsupportedIntent(interpretation) ? atomicLayaApproval(interpretation) : undefined
  const entailment = atomic ? atomic.question.type === 'noul' : Boolean(interpretation.businessCheck && !unsupportedIntent(interpretation))
  const confidence = answer && Number.isFinite(answer.answer_confidence) && answer.answer_confidence >= 0 && answer.answer_confidence <= 1
    ? answer.answer_confidence
    : 0
  const matches = entailment
    ? answer?.type === 'noul' && Number.isFinite(answer.noul) && answer.noul >= LAYA_RULE_CONFIDENCE && answer.noul <= 1
    : answer?.type === 'choice' && answer.choice === (atomic?.label ?? interpretation.category)
  const approved = !unsupportedIntent(interpretation) && matches && !answer?.low_confidence && confidence >= LAYA_RULE_CONFIDENCE &&
    !result.usage.truncated && !result.usage.truncated_questions?.length && !(result.usage.state_tokens_dropped && result.usage.state_tokens_dropped > 0)
  const warning = unsupportedIntent(interpretation)
    ? 'This rule cannot be represented safely by the supported execution plans. Rephrase it before validating with Laya AI.'
    : result.usage.truncated
      ? 'The rule exceeded the Laya AI input limit. Shorten the rule and validate again.'
      : 'Laya AI did not confidently approve this rule intent. Rephrase the rule and validate again; it will not run without AI approval.'
  return {
    ...interpretation,
    status: approved ? interpretation.status : 'unsupported',
    interpretationConfidence: Math.min(interpretation.interpretationConfidence, confidence),
    aiValidation: { provider: 'laya', model: LAYA_MODEL, decision: approved ? 'approved' : 'needs_review', confidence, method: entailment ? 'intent_entailment' : 'operation_choice' },
    warnings: approved ? interpretation.warnings : [warning, ...interpretation.warnings]
  }
}
