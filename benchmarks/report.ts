import type { RuleBenchmarkResult } from './model'

function escapeCell(value: string): string {
  return value.replace(/\|/gu, '\\|').replace(/[\r\n]+/gu, ' ')
}

export function benchmarkSummary(results: RuleBenchmarkResult[]) {
  const supported = results.filter((result) => result.expected.status === 'valid')
  const guardrails = results.filter((result) => result.expected.status !== 'valid')
  return {
    total: results.length, passed: results.filter((result) => result.passed).length,
    supported: supported.length, supportedPassed: supported.filter((result) => result.passed).length,
    guardrails: guardrails.length, guardrailsPassed: guardrails.filter((result) => result.passed).length,
    priorityMatches: results.filter((result) => result.priority === result.expected.priority).length,
    actionMatches: results.filter((result) => result.actionItem === result.expected.actionItem).length,
    unsafeExecutions: guardrails.filter((result) => result.canRun).length,
    suppliedRulesPassed: results.filter((result) => result.family === 'supplied dataset-only commercial rules' && result.passed).length,
    totalCaseMs: results.reduce((sum, result) => sum + result.latencyMs, 0)
  }
}

export function benchmarkMarkdown(results: RuleBenchmarkResult[], generatedAt: string, calls: number): string {
  const summary = benchmarkSummary(results)
  const families = [...new Set(results.map((result) => result.family))]
  const lines = [
    '# 150-rule real Laya benchmark', '', `Generated: ${generatedAt}`, '',
    'This is a live CPU inference run through the production NLP service, not mocked AI. Every case has a separate synthetic input dataset and an independently specified priority, action, mapping outcome and (for executable rules) finding rows.', '',
    `- Live Laya calls: ${calls}. Confidence threshold: 0.80, unchanged. No deterministic fallback.`,
    `- Overall: ${summary.passed}/${summary.total} passed.`,
    `- Supported-rule approval and execution: ${summary.supportedPassed}/${summary.supported}.`,
    `- Safe blocking of unsupported, ambiguous or unconfigured rules: ${summary.guardrailsPassed}/${summary.guardrails}.`,
    `- Simplified commercial rules: ${summary.suppliedRulesPassed}/11 passed end to end.`,
    `- Priority extraction: ${summary.priorityMatches}/${summary.total}; action extraction: ${summary.actionMatches}/${summary.total}.`,
    `- Unsafe executions: ${summary.unsafeExecutions}.`,
    `- Sum of case latency (includes interpretation and tiny dataset checks, excludes model startup): ${summary.totalCaseMs} ms.`, '',
    'A guardrail pass means the rule is blocked, not that it is executable. A supported-rule failure can be a conservative model refusal; inspect the confidence and positive probability in the JSON report. High confidence in a negative answer is never approval. Approved findings are checked against expected source rows and retain their priority/action.', '',
    'These are fixed regression examples, not a held-out accuracy estimate or proof of general natural-language understanding. All checks use only the selected dataset, built-in formats and inline values. Recognized unquoted columns and quoted text fragments are supported; arbitrary regex, automatic data changes and unrepresented conditions are intentionally refused.', '',
    '## By family', '', '| Family | Passed | Cases |', '| --- | ---: | ---: |',
    ...families.map((family) => { const group = results.filter((result) => result.family === family); return `| ${family} | ${group.filter((result) => result.passed).length} | ${group.length} |` }), '',
    '## Results', '', '| Case | Family | Expected | Actual | Laya decision | Confidence | Result |', '| --- | --- | --- | --- | --- | ---: | --- |',
    ...results.map((result) => `| ${result.id} | ${result.family} | ${result.expected.status} | ${result.status ?? 'error'} | ${result.aiValidation?.decision ?? 'error'} | ${result.aiValidation?.confidence.toFixed(4) ?? '-'} | ${result.passed ? 'PASS' : 'FAIL'} |`), '',
    '## Rules, priorities and action items', '', '| Case | Natural-language rule | Expected priority | Expected action |', '| --- | --- | --- | --- |',
    ...results.map((result) => `| ${result.id} | ${escapeCell(result.sourceText)} | ${result.expected.priority} | ${escapeCell(result.expected.actionItem)} |`), '', '## Failures', ''
  ]
  for (const result of results.filter((candidate) => !candidate.passed)) {
    lines.push(`### ${result.id}`, '', ...result.failures.map((failure) => `- ${failure}`), ...result.warnings.map((warning) => `- ${warning}`), '')
  }
  if (results.every((result) => result.passed)) lines.push('None.', '')
  return lines.join('\n')
}
