import type { QuestionDef, SystemOneResult } from 'laya-ts'

import { NlpService } from '../src/main/services/nlpService'

export function approvedLayaResult(choice = 'missing', confidence = 0.97): SystemOneResult {
  return {
    model: 'test-laya',
    answers: { validation: { type: 'choice', choice, probabilities: { [choice]: confidence, needs_review: 1 - confidence }, confidence, answer_confidence: confidence, action: { act_probability: confidence } } },
    usage: { input_tokens: 100, output_tokens: 0, truncated: false }
  }
}

export function mockLayaNlp(): NlpService {
  return new NlpService({
    predict: async (_state: unknown, questions: Record<string, QuestionDef>) => questions.validation?.type === 'noul'
      ? approvedLayaEntailment()
      : approvedLayaResult(Object.keys(questions.validation?.criteria as Record<string, string>)[0])
  })
}

export function approvedLayaEntailment(probability = 0.97, confidence = Math.max(probability, 1 - probability)): SystemOneResult {
  return { model: 'test-laya', answers: { validation: { type: 'noul', noul: probability, confidence, answer_confidence: confidence, action: { act_probability: confidence } } }, usage: { input_tokens: 100, output_tokens: 0, truncated: false } }
}
