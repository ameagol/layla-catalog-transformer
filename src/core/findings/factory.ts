import type { AnalysisSummary, Finding, FindingType } from '../model/domain'
import { EMPTY_ANALYSIS_SUMMARY } from '../model/defaults'

function stableHash(value: string): string {
  let hash = 2166136261

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }

  return (hash >>> 0).toString(36)
}

export function createFindingId(type: FindingType, ruleId: string, rowNumbers: number[]): string {
  return `finding-${stableHash(`${type}:${ruleId}:${[...rowNumbers].sort((left, right) => left - right).join(',')}`)}`
}

export function summarizeFindings(findings: Finding[]): AnalysisSummary {
  const summary = { ...EMPTY_ANALYSIS_SUMMARY, totalFindings: findings.length }

  for (const finding of findings) {
    if (finding.type === 'DUPLICATE') summary.duplicateGroups += 1
    else if (finding.type === 'POSSIBLE_DUPLICATE') summary.possibleDuplicateGroups += 1
    else if (finding.type === 'INVALID') summary.invalidValues += 1
    else if (finding.type === 'MISSING') summary.missingValues += 1
    else if (finding.type === 'INCONSISTENT') summary.consistencyViolations += 1
    else if (finding.type === 'UNIQUENESS_VIOLATION') summary.uniquenessViolations += 1
    else summary.ruleViolations += 1
  }

  return summary
}

