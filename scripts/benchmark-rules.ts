import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'

import { ruleBenchmarkCases } from '../benchmarks/rules150'
import { evaluateBenchmarkCase } from '../benchmarks/evaluate'
import { benchmarkMarkdown, benchmarkSummary } from '../benchmarks/report'
import type { RuleBenchmarkResult } from '../benchmarks/model'
import { LAYA_MODEL, LAYA_RULE_CONFIDENCE } from '../src/core/rules/layaValidation'
import { LayaService } from '../src/main/services/layaService'

const directory = resolve('benchmarks/results')
const modelPath = resolve(process.env.LAYA_MODEL_DIR ?? 'models/laya-multilingual')
const runtime = new LayaService(tmpdir(), modelPath)
const startedAt = new Date().toISOString()
await runtime.ready()
let calls = 0
const predictor = { predict: async (...args: Parameters<LayaService['predict']>) => {
  calls += 1
  return runtime.predict(...args)
} }
const results: RuleBenchmarkResult[] = []
for (const test of ruleBenchmarkCases) {
  const result = await evaluateBenchmarkCase(test, predictor)
  results.push(result)
  console.log(`${result.id} ${result.passed ? 'PASS' : 'FAIL'} ${result.status} ${result.aiValidation?.decision ?? 'error'} confidence=${result.aiValidation?.confidence ?? '-'} positive=${result.positiveProbability ?? '-'} ${result.latencyMs}ms`)
}
const generatedAt = new Date().toISOString()
const manifest = JSON.parse(await readFile(resolve(modelPath, 'manifest.json'), 'utf8'))
const summary = benchmarkSummary(results)
await mkdir(directory, { recursive: true })
await writeFile(resolve('benchmarks/rules-150.json'), `${JSON.stringify(ruleBenchmarkCases, null, 2)}\n`)
await writeFile(resolve('benchmarks/rules-150.txt'), `${ruleBenchmarkCases.map((test, index) => `${index + 1}. ${test.sourceText}`).join('\n\n')}\n`)
await writeFile(resolve(directory, 'laya-rules-150.json'), `${JSON.stringify({
  version: 1, startedAt, generatedAt, model: LAYA_MODEL, device: 'cpu', confidenceFloor: LAYA_RULE_CONFIDENCE,
  modelManifest: manifest, liveInferenceCalls: calls, summary, results
}, null, 2)}\n`)
await writeFile(resolve(directory, 'laya-rules-150.md'), benchmarkMarkdown(results, generatedAt, calls))
console.log(JSON.stringify(summary, null, 2))
console.log('Reports: benchmarks/results/laya-rules-150.md and benchmarks/results/laya-rules-150.json')
if (calls !== 150 || summary.passed !== 150) process.exitCode = 1
