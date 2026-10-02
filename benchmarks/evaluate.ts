import type { RuleBenchmarkCase, RuleBenchmarkResult } from './model'
import type { SystemOneResult } from 'laya-ts'
import { benchmarkRequest } from './fixtures'
import { analyzeDataset } from '../src/core/engine/analyze'
import { compileInterpretations } from '../src/core/rules/compiler'
import { interpretRules } from '../src/core/rules/interpreter'
import { NlpService } from '../src/main/services/nlpService'
import type { LayaPredictor } from '../src/main/services/layaService'

function sortedFields(fields: string[]): string[] {
  return [...new Set(fields)].sort()
}

export async function evaluateBenchmarkCase(test: RuleBenchmarkCase, runtime: LayaPredictor): Promise<RuleBenchmarkResult> {
  const started = performance.now()
  const failures: string[] = []
  const result: RuleBenchmarkResult = {
    id: test.id, family: test.family, sourceText: test.sourceText, expected: test.expected,
    canRun: false, warnings: [], latencyMs: 0, passed: false, failures
  }
  try {
    const request = benchmarkRequest(test)
    const candidate = interpretRules(request.rules, request.profile, request.columnMappings, request)[0]!
    result.candidateStatus = candidate.status
    if (candidate.status !== test.expected.status) failures.push(`Mapping status: expected ${test.expected.status}, received ${candidate.status}.`)
    let prediction: SystemOneResult | undefined
    const nlp = new NlpService({ predict: async (...args) => {
      prediction = await runtime.predict(...args)
      return prediction
    } })
    const [interpretation] = await nlp.interpret(request)
    if (!interpretation || !prediction) throw new Error('The production NLP service did not return a real Laya decision.')
    result.status = interpretation.status
    result.category = interpretation.category
    result.mappedFields = sortedFields(interpretation.fields.flatMap((field) => field.columnHeader ? [field.columnHeader] : []))
    result.priority = interpretation.priority
    result.actionItem = interpretation.actionItem
    result.aiValidation = interpretation.aiValidation
    result.warnings = interpretation.warnings
    const answer = prediction.answers.validation
    result.positiveProbability = answer?.type === 'noul' ? answer.noul : undefined
    if (test.expected.category && interpretation.category !== test.expected.category) failures.push(`Intent: expected ${test.expected.category}, received ${interpretation.category}.`)
    if (interpretation.priority !== test.expected.priority) failures.push('Priority extraction does not match the expected priority.')
    if (interpretation.actionItem !== test.expected.actionItem) failures.push('Action-item extraction does not match the expected action.')
    if (test.expected.fields && JSON.stringify(result.mappedFields) !== JSON.stringify(sortedFields(test.expected.fields))) failures.push('Mapped input columns do not match the expected columns.')
    const compilation = compileInterpretations([interpretation])
    result.canRun = compilation.canRun && interpretation.aiValidation?.decision === 'approved'
    if (test.expected.status === 'valid') {
      if (!result.canRun) failures.push('Supported rule did not pass the mandatory Laya approval and compilation gates.')
      else {
        const analysis = await analyzeDataset({
          projectId: 'laya-benchmark', sessionId: 'laya-benchmark', sheetName: request.profile.name, compilation,
          rows: test.records.map((values, index) => ({ rowNumber: index + 2, values }))
        })
        result.flaggedRows = [...new Set(analysis.findings.flatMap((finding) => finding.rowNumbers))].sort((left, right) => left - right)
        result.warnings.push(...analysis.warnings)
        if (JSON.stringify(result.flaggedRows) !== JSON.stringify(test.expected.flaggedRows)) failures.push(`Finding rows: expected ${JSON.stringify(test.expected.flaggedRows)}, received ${JSON.stringify(result.flaggedRows)}.`)
        if (analysis.findings.some((finding) => finding.priority !== test.expected.priority || finding.suggestedAction !== test.expected.actionItem)) failures.push('Finding priority/action does not match the mapped rule.')
      }
    } else if (result.canRun || compilation.compiledRules.some((rule) => rule.plan !== null)) failures.push('Safety failure: an unsupported or incompletely configured rule received an executable plan.')
  } catch (error) {
    failures.push(error instanceof Error ? error.message : String(error))
  }
  result.latencyMs = Math.round(performance.now() - started)
  result.passed = failures.length === 0
  return result
}
