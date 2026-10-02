import type { RulePriority } from '../model/businessRules'
import type { DatasetColumn, Finding } from '../model/domain'
import { impactPriority } from '../rules/metadata'

export interface RowActionItem {
  ruleId: string
  priority: RulePriority
  actionItem: string
  explanation: string
}

const PRIORITY_ORDER: Record<RulePriority, number> = { high: 0, medium_high: 1, medium: 2, low_medium: 3, low: 4 }

export function rowActionItems(findings: readonly Finding[], rowNumber: number): RowActionItem[] {
  const items = new Map<string, RowActionItem>()
  for (const finding of findings) {
    if (!finding.rowNumbers.includes(rowNumber)) continue
    const key = `${finding.ruleId}:${finding.suggestedAction}`
    const previous = items.get(key)
    if (previous) previous.explanation = [...new Set([previous.explanation, finding.explanation])].join(' ')
    else items.set(key, { ruleId: finding.ruleId, priority: finding.priority ?? impactPriority(finding.impactLevel ?? 'medium'), actionItem: finding.suggestedAction, explanation: finding.explanation })
  }
  return [...items.values()].sort((left, right) => PRIORITY_ORDER[left.priority] - PRIORITY_ORDER[right.priority])
}

export function findingAffectsCell(finding: Finding, rowNumber: number, column: Pick<DatasetColumn, 'key' | 'header'>): boolean {
  if (!finding.rowNumbers.includes(rowNumber)) return false
  const evidence = finding.evidence.filter((item) => item.rowNumber === rowNumber)
  return evidence.length ? evidence.some((item) => item.columnKey === column.key) : finding.fields.includes(column.key) || finding.fields.includes(column.header)
}
