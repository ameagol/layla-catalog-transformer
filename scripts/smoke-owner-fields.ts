import assert from 'node:assert/strict'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'

import { analyzeDataset } from '../src/core/engine/analyze'
import { compileInterpretations } from '../src/core/rules/compiler'
import { parseSourceRules } from '../src/core/rules/source'
import { applyLayaValidation, layaRuleInput, layaRuleQuestions } from '../src/core/rules/layaValidation'
import { LayaService } from '../src/main/services/layaService'
import { NlpService } from '../src/main/services/nlpService'
import { referenceDataset } from '../tests/business-rule-fixtures'

const action = 'Route it to the account’s current owner or the Data Steward to confirm the correct assignment.'
const rules = parseSourceRules(`Owner fields must identify the same person. If SFDC Veg Owner, Veg Owner Name, and Proposed Veg Owner FND ID identify different people, flag a medium- to high-priority ownership conflict. ${action}`)
const dataset = referenceDataset('Accounts', [
  { 'SFDC Veg Owner': 'Alice', 'Veg Owner Name': 'Alice', 'Proposed Veg Owner FND ID': 'Alice' },
  { 'SFDC Veg Owner': 'Alice', 'Veg Owner Name': 'Bob', 'Proposed Veg Owner FND ID': 'Alice' }
])
const runtime = new LayaService(tmpdir(), resolve('models/laya-multilingual'))
const service = new NlpService(runtime)
const interpretations = await service.interpret({ rules, profile: dataset.profile, columnMappings: {} })
const interpretation = interpretations[0]!
console.log(JSON.stringify({ status: interpretation.status, priority: interpretation.priority, actionItem: interpretation.actionItem, reference: interpretation.reference ?? null, aiValidation: interpretation.aiValidation, warnings: interpretation.warnings }, null, 2))
assert.equal(interpretation.status, 'valid')
assert.equal(interpretation.aiValidation?.decision, 'approved')
assert.equal(interpretation.priority, 'medium')
assert.equal(interpretation.actionItem, action)
assert.equal(interpretation.reference, undefined)
const result = await analyzeDataset({ projectId: 'owner-smoke', sessionId: 'owner-smoke', sheetName: 'Accounts', rows: dataset.rows, compilation: compileInterpretations(interpretations) })
assert.deepEqual(result.findings.flatMap((finding) => finding.rowNumbers), [3])
const input = layaRuleInput(interpretation)
assert.equal(typeof input, 'object')
const mismatch = await runtime.predict({ ...input as object, proposed_check: 'Find duplicate customers across different rows using their postal codes.' }, layaRuleQuestions(interpretation), { lang: 'en', minConfidence: 0.8 })
assert.equal(applyLayaValidation(interpretation, mismatch).aiValidation?.decision, 'needs_review')
console.log('Real Laya approved the original owner rule. Only the differing row was flagged, with Medium priority and the exact action. No reference worksheet was used.')
console.log('A deliberately different detection intent was rejected by real Laya.')
