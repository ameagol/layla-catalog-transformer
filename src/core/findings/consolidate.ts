import type { Finding, FindingReviewGroup } from '../model/domain'
import { sortFindingsByImpact } from './review'
import { priorityImpact } from '../rules/metadata'

export function consolidateFindings(findings: readonly Finding[]): FindingReviewGroup[] {
  const ordered = sortFindingsByImpact(findings)
  const parents = ordered.map((_, index) => index)
  const rowOwners = new Map<string, number>()

  function rootOf(index: number): number {
    let root = index
    while (parents[root] !== root) root = parents[root]!
    while (parents[index] !== index) {
      const parent = parents[index]!
      parents[index] = root
      index = parent
    }
    return root
  }

  ordered.forEach((finding, index) => {
    for (const rowNumber of finding.rowNumbers) {
      const rowKey = JSON.stringify([finding.sheet, rowNumber])
      const owner = rowOwners.get(rowKey)
      if (owner === undefined) rowOwners.set(rowKey, index)
      else {
        const ownerRoot = rootOf(owner)
        const currentRoot = rootOf(index)
        parents[Math.max(ownerRoot, currentRoot)] = Math.min(ownerRoot, currentRoot)
      }
    }
  })

  const groups = new Map<number, Finding[]>()
  ordered.forEach((finding, index) => {
    const root = rootOf(index)
    const group = groups.get(root)
    if (group) group.push(finding)
    else groups.set(root, [finding])
  })

  return [...groups.values()].map((members) => {
    const first = members[0]!
    return {
      id: first.id,
      sheet: first.sheet,
      types: [...new Set(members.map((finding) => finding.type))],
      rowNumbers: [...new Set(members.flatMap((finding) => finding.rowNumbers))].sort((left, right) => left - right),
      fields: [...new Set(members.flatMap((finding) => finding.fields))],
      evidence: members.flatMap((finding) => finding.evidence),
      findings: members,
      impactLevel: first.impactLevel ?? priorityImpact(first.priority),
      explanation: [...new Set(members.map((finding) => finding.explanation))].join(' ')
    }
  })
}
