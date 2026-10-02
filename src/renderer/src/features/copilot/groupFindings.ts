import type { Finding } from '@core/model/domain'

import { priorityForFinding } from './triage'

export interface FindingGroup {
  key: string
  type: Finding['type']
  ruleText: string
  findings: Finding[]
  affectedRows: number
  rank: number
}

export function groupFindings(findings: Finding[]): FindingGroup[] {
  const groups = new Map<string, Omit<FindingGroup, 'affectedRows'>>()
  for (const finding of findings) {
    const key = `${finding.type}:${finding.ruleId}`
    const current = groups.get(key)
    if (current) {
      current.findings.push(finding)
      current.rank = Math.max(current.rank, priorityForFinding(finding).rank)
    } else {
      groups.set(key, {
        key,
        type: finding.type,
        ruleText: finding.ruleText,
        findings: [finding],
        rank: priorityForFinding(finding).rank
      })
    }
  }
  return [...groups.values()].map((group) => ({
    ...group,
    findings: group.findings.sort((a, b) => priorityForFinding(b).rank - priorityForFinding(a).rank),
    affectedRows: new Set(group.findings.flatMap((finding) => finding.rowNumbers)).size
  })).sort((a, b) => b.rank - a.rank || b.findings.length - a.findings.length || a.ruleText.localeCompare(b.ruleText))
}
