import type { AnalysisResult, Finding } from '../model/domain'
import type { CopilotRowContext } from '../ipc/contracts'

export type GuidanceRoute = 'review_duplicate' | 'verify_source' | 'complete_attribute' | 'check_relationship' | 'review_rule' | 'human_review'
export type GuidanceStatus = 'unavailable' | 'needs_review' | 'laya'

export interface CopilotGuidance {
  status: GuidanceStatus
  route: GuidanceRoute
  impact: string
  nextStep: string
  signals?: string[]
  confidence?: number
}

export function selectCurrentFinding(result: AnalysisResult | null, analysisId: string, findingId: string): Finding {
  if (!result || result.id !== analysisId) throw new Error('Analysis is no longer active. Run the analysis again.')
  const finding = result.findings.find((item) => item.id === findingId)
  if (!finding) throw new Error('Finding does not belong to the active analysis.')
  return finding
}

export function routeForFinding(finding: Finding): GuidanceRoute {
  if (finding.type === 'DUPLICATE' || finding.type === 'POSSIBLE_DUPLICATE') return 'review_duplicate'
  if (finding.type === 'MISSING') return 'complete_attribute'
  if (finding.type === 'INVALID' || finding.type === 'INCONSISTENT') return 'verify_source'
  return 'human_review'
}

export function allowedGuidanceRoutes(finding: Finding, signals: string[] = [], ruleNeedsReview = false): GuidanceRoute[] {
  const routes: GuidanceRoute[] = [routeForFinding(finding)]
  if (finding.type === 'MISSING' || finding.type === 'DUPLICATE' || finding.type === 'UNIQUENESS_VIOLATION' ||
      finding.type === 'NORMALIZATION_CONFLICT' || finding.type === 'RULE_VIOLATION') routes.push('verify_source')
  if (finding.type === 'POSSIBLE_DUPLICATE' && signals.some((signal) => signal.includes('not equal'))) routes.push('check_relationship')
  if (ruleNeedsReview) routes.push('review_rule')
  routes.push('human_review')
  return [...new Set(routes)]
}

export function localGuidance(finding: Finding, route = routeForFinding(finding)): CopilotGuidance {
  const nextStep: Record<GuidanceRoute, string> = {
    review_duplicate: 'Compare the records against an authorized source before deciding whether they represent the same entity.',
    verify_source: 'Check the value against an authorized source and validate the rule before requesting a change.',
    complete_attribute: 'Consult the authorized source to complete the missing attribute after human confirmation.',
    check_relationship: 'Check whether these are related but distinct records before considering consolidation.',
    review_rule: 'Confirm this rule and its column mapping before routing a record-level correction.',
    human_review: 'Route this finding for human review and confirm the rule and source records.'
  }
  return {
    status: 'unavailable',
    route,
    impact: route === 'review_duplicate'
      ? 'Potential impact: duplicate records may distort counts or grouping. Confirm against the source.'
      : route === 'complete_attribute'
        ? 'Potential impact: the missing attribute may limit processes that depend on this field.'
        : 'Potential impact depends on the business rule and source-data confirmation.',
    nextStep: nextStep[route]
  }
}

export function comparisonSignals(finding: Finding, context: CopilotRowContext): string[] {
  if (finding.type !== 'POSSIBLE_DUPLICATE' || context.rows.length !== 2) return []
  const [left, right] = context.rows
  return context.columns.flatMap((column) => {
    const a = left?.values[column.key]?.trim() ?? ''
    const b = right?.values[column.key]?.trim() ?? ''
    if (!a || !b) return []
    const matched = a.toLocaleLowerCase() === b.toLocaleLowerCase()
    return [`${column.header}: ${matched ? 'equal after case/space normalization' : 'not equal after case/space normalization'}; verify against source`]
  })
}

export function layaGuidance(finding: Finding, choice: unknown, confidence: unknown, signals: string[] = [], ruleNeedsReview = false): CopilotGuidance {
  if (typeof choice !== 'string' || !allowedGuidanceRoutes(finding, signals, ruleNeedsReview).includes(choice as GuidanceRoute) ||
      typeof confidence !== 'number' || !Number.isFinite(confidence) || confidence < 0.8 || confidence > 1) {
    return { ...localGuidance(finding, 'human_review'), status: 'needs_review' }
  }
  return { ...localGuidance(finding, choice as GuidanceRoute), status: 'laya', confidence }
}
