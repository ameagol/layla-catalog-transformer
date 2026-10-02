import type { CellValue } from '../src/core/model/domain'
import type { RuleBenchmarkCase } from './model'
import { referenceDataset } from '../tests/business-rule-fixtures'

const priorities = [
  ['high', 'High'], ['medium_high', 'Medium / High'], ['medium', 'Medium'], ['low_medium', 'Low / Medium'], ['low', 'Low']
] as const

export function benchmarkCase(index: number, family: string, detection: string, records: Record<string, CellValue>[], fields: string[] | undefined, flaggedRows: number[] | undefined, action: string, overrides: Partial<RuleBenchmarkCase> = {}): RuleBenchmarkCase {
  const [priority, label] = priorities[(index - 1) % priorities.length]!
  const actionLabel = index % 3 === 0 ? 'Recommended action' : index % 3 === 1 ? 'Action' : 'Action item'
  return {
    id: `BENCH-${String(index).padStart(3, '0')}`, family,
    sourceText: `${detection} Priority: ${label}. ${actionLabel}: ${action}`,
    records, expected: { status: 'valid', fields, priority, actionItem: action, flaggedRows }, ...overrides
  }
}

export function benchmarkProfile(test: RuleBenchmarkCase) {
  return test.profile ?? referenceDataset('Benchmark input', test.records).profile
}

export function benchmarkRequest(test: RuleBenchmarkCase) {
  return {
    rules: [{ id: test.id, sourceText: test.sourceText, order: 0, enabled: true }],
    profile: benchmarkProfile(test), columnMappings: test.columnMappings ?? {},
    ruleConfigurations: test.configuration ? { [test.id]: test.configuration } : {}
  }
}
