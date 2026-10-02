import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import assert from 'node:assert/strict'

import { LayaService } from '../src/main/services/layaService'
import { NlpService } from '../src/main/services/nlpService'
import { businessContext, businessProfile, businessRules } from '../tests/business-rule-fixtures'
import { interpretRules } from '../src/core/rules/interpreter'
import { applyLayaValidation, layaRuleInput, layaRuleQuestions } from '../src/core/rules/layaValidation'

const runtime = new LayaService(tmpdir(), resolve('models/laya-multilingual'))
const service = new NlpService(runtime)
let approved = 0
for (const [index, rule] of businessRules.entries()) {
  const [interpretation] = await service.interpret({ rules: [rule], profile: businessProfile, columnMappings: {}, ...businessContext })
  console.log(`Rule ${index + 1}: ${interpretation?.category} / ${interpretation?.status} / ${interpretation?.aiValidation?.decision} / ${interpretation?.aiValidation?.confidence}`)
  if (interpretation?.status === 'valid' && interpretation.aiValidation?.decision === 'approved') approved += 1
}
if (approved !== businessRules.length) throw new Error(`Laya approved ${approved} of ${businessRules.length} business rules. No approval bypass is permitted.`)
console.log(`All ${businessRules.length} dataset-only commercial rules passed real local Laya inference.`)
for (const index of [0, 6, 7, 10]) {
  const candidate = interpretRules([businessRules[index]!], businessProfile, {}, businessContext)[0]!
  const proposed_check = index === 6 || index === 7 ? 'Find rows with a missing Email address.' : 'Check whether each State is a valid US state.'
  const result = await runtime.predict({ ...layaRuleInput(candidate) as object, proposed_check }, layaRuleQuestions(candidate), { lang: 'en', minConfidence: 0.8 })
  assert.equal(applyLayaValidation(candidate, result).aiValidation?.decision, 'needs_review', `Rule ${index + 1} must reject a deliberately wrong proposed check.`)
}
console.log('Real Laya rejected four deliberately incorrect detection intents.')
