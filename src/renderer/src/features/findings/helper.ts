import type {
  CompilationResult,
  Finding,
  FindingEvidence,
  FindingReviewGroup,
  FindingSourceRows,
  FindingType,
  ProjectRecord,
  Severity,
  WorkbookProfile
} from '@core/model/domain'
import { stringifyCellValue } from '@core/normalization/normalizers'
import { sortFindingsByImpact } from '@core/findings/review'
import { findingAffectsCell, rowActionItems } from '@core/findings/rowActions'

import { FINDING_TYPE_LABELS, INLINE_ROW_LIMIT } from './constants'
import type { AnalysisReadinessCheck, FindingFilters, SourceRowView } from './models'

export function findingTypeLabel(type: FindingType): string {
  return FINDING_TYPE_LABELS[type]
}

export function findingTone(type: FindingType): 'accent' | 'warning' | 'danger' | 'aqua' | 'neutral' {
  if (type === 'DUPLICATE') return 'accent'
  if (type === 'POSSIBLE_DUPLICATE') return 'warning'
  if (type === 'INVALID' || type === 'INCONSISTENT') return 'danger'
  if (type === 'MISSING' || type === 'UNIQUENESS_VIOLATION') return 'warning'
  return 'aqua'
}

export function severityTone(severity: Severity): 'neutral' | 'warning' | 'danger' {
  if (severity === 'critical' || severity === 'error') return 'danger'
  if (severity === 'warning') return 'warning'
  return 'neutral'
}

export function groupEvidenceByRow(finding: Finding): Array<{ rowNumber: number; evidence: FindingEvidence[] }> {
  const grouped = new Map<number, FindingEvidence[]>()
  for (const evidence of finding.evidence) {
    const rowEvidence = grouped.get(evidence.rowNumber) ?? []
    rowEvidence.push(evidence)
    grouped.set(evidence.rowNumber, rowEvidence)
  }
  return [...grouped.entries()].map(([rowNumber, evidence]) => ({ rowNumber, evidence }))
}

export function formatFindingRows(rowNumbers: readonly number[]): string {
  const rows = [...new Set(rowNumbers)].sort((left, right) => left - right)
  if (rows.length > INLINE_ROW_LIMIT) return '[ Multi ]'
  return `[ ${rows.length ? rows.join(', ') : 'None'} ]`
}

export function isWorksheetIssue(finding: FindingReviewGroup): boolean {
  return finding.findings.length > 0 && finding.findings.every((issue) => issue.scope === 'worksheet')
}

export function findingLocation(finding: FindingReviewGroup): string {
  return isWorksheetIssue(finding) ? `Worksheet column: ${finding.fields.join(', ')}` : `Affected Rows ${formatFindingRows(finding.rowNumbers)}`
}

export function filterFindings(findings: readonly Finding[], filters: FindingFilters): Finding[] {
  const query = filters.search.trim().toLocaleLowerCase()
  return sortFindingsByImpact(findings.filter((finding) => {
    if (filters.type !== 'all' && finding.type !== filters.type) return false
    if (filters.severity !== 'all' && finding.severity !== filters.severity) return false
    if (filters.confidence !== 'all' && finding.confidence !== filters.confidence) return false
    if (!query) return true
    return [
      findingTypeLabel(finding.type), finding.ruleText, finding.explanation, finding.suggestedAction,
      ...finding.fields, ...finding.rowNumbers,
      ...finding.evidence.map((evidence) => stringifyCellValue(evidence.originalValue))
    ].join(' ').toLocaleLowerCase().includes(query)
  }))
}

export function getAnalysisReadiness(
  project: ProjectRecord | null,
  workbook: WorkbookProfile | null,
  compilation: CompilationResult | null
): AnalysisReadinessCheck[] {
  const executableCount = compilation?.compiledRules.filter((rule) => rule.plan !== null).length ?? 0
  return [
    { label: 'Project', ready: Boolean(project), detail: project?.name ?? 'Select a project.', path: '/projects' },
    { label: 'Dataset', ready: Boolean(workbook), detail: workbook ? `${workbook.fileName} · ${workbook.selectedSheet.name}` : 'Load a dataset.', path: '/dataset' },
    { label: 'Rule source', ready: Boolean(project?.rulesText.trim()), detail: project?.rulesText.trim() ? 'Rule source is ready.' : 'Add at least one rule.', path: '/rules' },
    { label: 'Execution plan', ready: Boolean(compilation?.canRun), detail: compilation?.canRun ? `${executableCount} executable rules.` : 'Validate and save your rules and column mappings.', path: '/rules' }
  ]
}

export function filterFindingGroups(groups: readonly FindingReviewGroup[], filters: FindingFilters): FindingReviewGroup[] {
  return groups.filter((group) => filterFindings(group.findings, filters).length > 0)
}

export function buildSourceRowView(source: FindingSourceRows, finding: Finding | FindingReviewGroup): SourceRowView[] {
  const evidenceByCell = new Map(finding.evidence.map((evidence) => [
    `${evidence.rowNumber}:${evidence.columnKey}`, evidence
  ]))
  return source.rows.map((row) => ({
    rowNumber: row.rowNumber,
    actions: rowActionItems('findings' in finding ? finding.findings : [finding], row.rowNumber),
    cells: source.columns.map((column) => {
      const original = stringifyCellValue(row.values[column.key] ?? null)
      const evidence = evidenceByCell.get(`${row.rowNumber}:${column.key}`)
      return {
        columnKey: column.key,
        original,
        normalized: evidence && evidence.normalizedValue !== original ? evidence.normalizedValue : null,
        affected: ('findings' in finding ? finding.findings : [finding]).some((member) => findingAffectsCell(member, row.rowNumber, column))
      }
    })
  }))
}
