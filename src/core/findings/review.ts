import type { AnalysisRowReview, Finding, ImpactLevel } from '../model/domain'
import { priorityImpact } from '../rules/metadata'

const IMPACT_ORDER: Record<ImpactLevel, number> = { large: 0, medium: 1, small: 2 }

export function sortFindingsByImpact(findings: readonly Finding[]): Finding[] {
  return [...findings].sort((left, right) =>
    IMPACT_ORDER[left.impactLevel ?? priorityImpact(left.priority)] - IMPACT_ORDER[right.impactLevel ?? priorityImpact(right.priority)]
  )
}

export function acceptedRowsForReview(review: AnalysisRowReview | null, analysisId: string): number[] {
  if (review?.analysisId !== analysisId) return []
  return Object.entries(review.decisions).filter(([, decision]) => decision === 'accept').map(([rowNumber]) => Number(rowNumber)).sort((left, right) => left - right)
}

export function summarizeRowReview(findings: readonly Finding[], rowCount: number, review: AnalysisRowReview | null, analysisId: string) {
  const flagged = new Set(findings.flatMap((finding) => finding.rowNumbers))
  const accepted = acceptedRowsForReview(review, analysisId).filter((row) => flagged.has(row)).length
  const excluded = deletedRowsForReview(review, analysisId).filter((row) => flagged.has(row)).length
  return { accepted, excluded, unreviewed: flagged.size - accepted - excluded, clean: Math.max(0, rowCount - flagged.size) }
}

export function deletedRowsForReview(review: AnalysisRowReview | null, analysisId: string): number[] {
  if (review?.analysisId !== analysisId) return []
  return Object.entries(review.decisions)
    .filter(([, decision]) => decision === 'delete')
    .map(([rowNumber]) => Number(rowNumber))
    .sort((left, right) => left - right)
}
