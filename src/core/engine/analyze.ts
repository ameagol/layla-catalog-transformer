import type { AnalysisResult, CompilationResult, DatasetRow, Finding } from '../model/domain'
import { summarizeFindings } from '../findings/factory'
import { executeDuplicateRule } from './duplicate'
import { NormalizationCache } from './normalizationCache'
import { executeBusinessRule } from './businessExecutors'
import {
  executeConsistencyRule,
  executeMissingRule,
  executeUniquenessRule,
  executeValidationRule
} from './ruleExecutors'

export interface AnalysisProgress {
  stage: 'compile' | 'normalize' | 'execute' | 'finalize'
  percent: number
  message: string
}

export interface AnalyzeDatasetInput {
  projectId: string
  sessionId: string
  sheetName: string
  rows: DatasetRow[]
  compilation: CompilationResult
  onProgress?: (progress: AnalysisProgress) => void
}

const SEVERITY_ORDER = { critical: 0, error: 1, warning: 2, info: 3 }

export async function analyzeDataset(input: AnalyzeDatasetInput): Promise<AnalysisResult> {
  const startedAt = new Date().toISOString()
  const startedTime = performance.now()
  const cache = new NormalizationCache()
  const findings: Finding[] = []
  const warnings = input.compilation.issues.map((issue) => issue.message)
  const executableRules = input.compilation.compiledRules.filter((rule) => rule.plan !== null)

  input.onProgress?.({ stage: 'compile', percent: 5, message: 'Execution plan validated.' })

  for (let index = 0; index < executableRules.length; index += 1) {
    const rule = executableRules[index]
    if (!rule?.plan) continue
    const percent = 10 + Math.round((index / Math.max(executableRules.length, 1)) * 80)
    input.onProgress?.({ stage: 'execute', percent, message: `Applying rule ${index + 1} of ${executableRules.length}.` })

    if (rule.plan.kind === 'business') {
      const result = executeBusinessRule(input.rows, rule, input.sheetName, startedAt)
      findings.push(...result.findings)
      warnings.push(...result.warnings)
    } else if (rule.plan.kind === 'duplicate') {
      const result = executeDuplicateRule(input.rows, rule, input.sheetName, cache, startedAt)
      findings.push(...result.findings)
      warnings.push(...result.warnings)
    } else if (rule.plan.kind === 'validation') {
      findings.push(...executeValidationRule(input.rows, rule, input.sheetName, startedAt))
    } else if (rule.plan.kind === 'missing') {
      findings.push(...executeMissingRule(input.rows, rule, input.sheetName, startedAt))
    } else if (rule.plan.kind === 'uniqueness') {
      findings.push(...executeUniquenessRule(input.rows, rule, input.sheetName, cache, startedAt))
    } else if (rule.plan.kind === 'consistency') {
      findings.push(...executeConsistencyRule(input.rows, rule, input.sheetName, cache, startedAt))
    }

    await new Promise<void>((resolve) => setTimeout(resolve, 0))
  }

  const ruleMetadata = new Map(executableRules.map((rule) => [rule.id, rule.interpretation]))
  for (const finding of findings) {
    const metadata = ruleMetadata.get(finding.ruleId)
    if (metadata?.priority) finding.priority = metadata.priority
    if (metadata?.actionItem) finding.suggestedAction = metadata.actionItem
  }

  findings.sort((left, right) => {
    const severityDifference = SEVERITY_ORDER[left.severity] - SEVERITY_ORDER[right.severity]
    return severityDifference !== 0 ? severityDifference : (left.rowNumbers[0] ?? 0) - (right.rowNumbers[0] ?? 0)
  })

  input.onProgress?.({ stage: 'finalize', percent: 96, message: 'Building explanations and summary.' })
  const completedAt = new Date().toISOString()
  const result: AnalysisResult = {
    id: crypto.randomUUID(),
    projectId: input.projectId,
    sessionId: input.sessionId,
    sheetName: input.sheetName,
    startedAt,
    completedAt,
    durationMs: Math.round(performance.now() - startedTime),
    rowsAnalyzed: input.rows.length,
    rulesExecuted: executableRules.length,
    findings,
    summary: summarizeFindings(findings),
    warnings: [...new Set(warnings)],
    compilation: input.compilation
  }

  input.onProgress?.({ stage: 'finalize', percent: 100, message: 'Analysis complete.' })
  return result
}
