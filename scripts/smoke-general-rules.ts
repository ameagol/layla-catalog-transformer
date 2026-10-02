import { mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { generalLanguageCases } from '../benchmarks/generalLanguageCases'
import { ruleInputExamples } from '../benchmarks/ruleInputExamples'
import { analyzeDataset } from '../src/core/engine/analyze'
import { compileInterpretations } from '../src/core/rules/compiler'
import { parseSourceRules } from '../src/core/rules/source'
import { applyLayaValidation, layaRuleInput, layaRuleQuestions, LAYA_MODEL, LAYA_RULE_CONFIDENCE } from '../src/core/rules/layaValidation'
import { interpretRules } from '../src/core/rules/interpreter'
import { LayaService } from '../src/main/services/layaService'
import { NlpService } from '../src/main/services/nlpService'
import { referenceDataset } from '../tests/business-rule-fixtures'

const runtime = new LayaService(tmpdir(), resolve(process.env.LAYA_MODEL_DIR ?? 'models/laya-multilingual'))
const service = new NlpService(runtime)
const selected = process.argv.includes('--reported-only') ? generalLanguageCases.slice(0, 3) : [...generalLanguageCases, ...ruleInputExamples]
const results = []
for (const test of selected) {
  const dataset = referenceDataset('Input', test.records)
  const interpretations = await service.interpret({ rules: parseSourceRules(test.text), profile: dataset.profile, columnMappings: {} })
  const compilation = compileInterpretations(interpretations)
  const analysis = compilation.canRun ? await analyzeDataset({ projectId: 'general-smoke', sessionId: 'general-smoke', sheetName: 'Input', rows: dataset.rows, compilation }) : undefined
  const rows = [...new Set(analysis?.findings.flatMap((finding) => finding.rowNumbers))].sort((left, right) => left - right)
  const missingColumns = analysis?.findings.filter((finding) => finding.scope === 'worksheet').flatMap((finding) => finding.fields) ?? []
  const passed = test.blocked ? !compilation.canRun : compilation.canRun && JSON.stringify(rows) === JSON.stringify(test.rows) && JSON.stringify(missingColumns) === JSON.stringify(test.missingColumns ?? [])
  const result = { source: test.text, passed, blocked: Boolean(test.blocked), canRun: compilation.canRun, rows, missingColumns, status: interpretations[0]?.status, aiValidation: interpretations[0]?.aiValidation, warnings: interpretations[0]?.warnings }
  results.push(result)
  console.log(`${passed ? 'PASS' : 'FAIL'} ${test.text} ${JSON.stringify(result.aiValidation)}`)
}
const controls = []
if (!process.argv.includes('--reported-only')) {
  for (const [index, wrongIntent] of [
    [0, 'Phone must be empty.'],
    [1, 'Find duplicate Name values across rows.'],
    [22, 'Phone must not be empty.'],
    [24, 'Find duplicate customers across different rows.']
  ] as const) {
    const test = generalLanguageCases[index]!
    const dataset = referenceDataset('Input', test.records)
    const candidate = interpretRules(parseSourceRules(test.text), dataset.profile)[0]!
    const input = layaRuleInput(candidate)
    const result = await runtime.predict(typeof input === 'string' ? wrongIntent : { ...input, proposed_check: wrongIntent }, layaRuleQuestions(candidate), { lang: 'en', minConfidence: LAYA_RULE_CONFIDENCE })
    const rejected = applyLayaValidation(candidate, result).aiValidation?.decision === 'needs_review'
    controls.push({ source: test.text, wrongIntent, rejected })
    console.log(`${rejected ? 'PASS' : 'FAIL'} incorrect-intent control: ${wrongIntent}`)
  }
}
const summary = { generatedAt: new Date().toISOString(), model: LAYA_MODEL, confidenceFloor: LAYA_RULE_CONFIDENCE, total: results.length, passed: results.filter((result) => result.passed).length, unsafeExecutions: results.filter((result) => result.blocked && result.canRun).length, negativeControls: controls.length, rejectedIncorrectIntents: controls.filter((control) => control.rejected).length }
console.log(JSON.stringify(summary, null, 2))
if (!process.argv.includes('--reported-only')) {
  await mkdir(resolve('benchmarks/results'), { recursive: true })
  await writeFile(resolve('benchmarks/results/laya-general-language.json'), `${JSON.stringify({ ...summary, results, controls }, null, 2)}\n`)
}
if (summary.passed !== summary.total || controls.some((control) => !control.rejected)) process.exitCode = 1
