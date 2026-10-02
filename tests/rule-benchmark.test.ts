import { describe, expect, it } from 'vitest'

import { ruleBenchmarkCases } from '../benchmarks/rules150'
import { benchmarkRequest } from '../benchmarks/fixtures'
import { analyzeDataset } from '../src/core/engine/analyze'
import { compileInterpretations } from '../src/core/rules/compiler'
import { interpretRules } from '../src/core/rules/interpreter'

describe('150-rule deterministic benchmark preflight (not an AI approval test)', () => {
  it('has exactly 150 unique rules, five priorities, explicit actions and both executable and blocked cases', () => {
    expect(ruleBenchmarkCases).toHaveLength(150)
    expect(new Set(ruleBenchmarkCases.map((test) => test.sourceText)).size).toBe(150)
    expect(new Set(ruleBenchmarkCases.map((test) => test.expected.priority)).size).toBe(5)
    expect(ruleBenchmarkCases.filter((test) => test.expected.status === 'valid')).toHaveLength(122)
    expect(ruleBenchmarkCases.every((test) => !('references' in test) && !test.configuration?.reference)).toBe(true)
    expect(ruleBenchmarkCases.every((test) => test.expected.actionItem.length > 0)).toBe(true)
  })

  it.each(ruleBenchmarkCases)('$id: $family', async (test) => {
    const request = benchmarkRequest(test)
    const interpretations = interpretRules(request.rules, request.profile, request.columnMappings, request)
    const interpretation = interpretations[0]!
    expect(interpretation.status, interpretation.warnings.join(' ')).toBe(test.expected.status)
    if (test.expected.category) expect(interpretation.category).toBe(test.expected.category)
    expect(interpretation.priority).toBe(test.expected.priority)
    expect(interpretation.actionItem).toBe(test.expected.actionItem)
    if (test.expected.fields) expect([...new Set(interpretation.fields.flatMap((field) => field.columnHeader ? [field.columnHeader] : []))].sort()).toEqual([...test.expected.fields].sort())
    const compilation = compileInterpretations(interpretations)
    expect(compilation.canRun).toBe(test.expected.status === 'valid')
    if (test.expected.status !== 'valid') return
    const result = await analyzeDataset({
      projectId: 'benchmark', sessionId: 'benchmark', sheetName: request.profile.name,
      compilation, rows: test.records.map((values, index) => ({ rowNumber: index + 2, values }))
    })
    expect([...new Set(result.findings.flatMap((finding) => finding.rowNumbers))].sort((left, right) => left - right)).toEqual(test.expected.flaggedRows)
    expect(result.findings.every((finding) => finding.priority === test.expected.priority && finding.suggestedAction === test.expected.actionItem)).toBe(true)
  })
})
