import type { Finding } from '@core/model/domain'

export { ownerForFinding, impactForFinding } from '@core/copilot/triage'

export function priorityForFinding(finding: Finding): { rank: number; label: 'high' | 'medium' | 'low'; tone: 'danger' | 'warning' | 'neutral' } {
  const severity = { critical: 4, error: 3, warning: 2, info: 1 }[finding.severity]
  const confidence = { HIGH: 3, MEDIUM: 2, LOW: 1 }[finding.confidence]
  if (finding.impactLevel) {
    const impact = { small: 1, medium: 2, large: 3 }[finding.impactLevel]
    return {
      rank: impact * 100 + severity * 10 + confidence,
      label: impact === 3 ? 'high' : impact === 2 ? 'medium' : 'low',
      tone: impact === 3 ? 'danger' : impact === 2 ? 'warning' : 'neutral'
    }
  }
  const high = severity === 4 || (severity === 3 && confidence >= 2)
  return {
    rank: severity * 10 + confidence,
    label: high ? 'high' : severity >= 2 ? 'medium' : 'low',
    tone: high ? 'danger' : severity >= 2 ? 'warning' : 'neutral'
  }
}
