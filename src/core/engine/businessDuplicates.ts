import type { BusinessExecutionPlan } from '../model/businessRules'
import type { CompiledRule, DatasetRow, Finding } from '../model/domain'
import { calculateSimilarity } from '../matching/similarity'
import { stringifyCellValue } from '../normalization/normalizers'
import { UnionFind } from './duplicate'
import { businessFinding, sourceValue } from './businessValues'

export function executeBusinessDuplicates(rows: DatasetRow[], rule: CompiledRule, plan: BusinessExecutionPlan, sheet: string, createdAt: string): Finding[] {
  const check = plan.check
  if (check.kind === 'duplicate_fields') {
    const groups = new Map<string, DatasetRow[]>()
    for (const row of rows) {
      const values = check.targets.map((token) => check.normalized ? sourceValue(row, plan, token) : stringifyCellValue(row.values[plan.fields[token]!.columnKey] ?? null).trim())
      if (values.some((value) => !value)) continue
      const key = JSON.stringify(values)
      const group = groups.get(key) ?? []
      group.push(row)
      groups.set(key, group)
    }
    return [...groups.values()].filter((group) => group.length > 1).map((group) => businessFinding(rule, plan, group, check.targets, 'DUPLICATE', `The ${check.normalized ? 'normalized ' : ''}combination of ${check.targets.join(' and ')} matches exactly across these rows. Review before merging.`, sheet, createdAt))
  }
  if (check.kind === 'unique_any') {
    return check.targets.flatMap((token) => {
      const groups = new Map<string, DatasetRow[]>()
      for (const row of rows) {
        const value = stringifyCellValue(row.values[plan.fields[token]!.columnKey] ?? null).trim()
        if (!value) continue
        const group = groups.get(value) ?? []
        group.push(row)
        groups.set(value, group)
      }
      return [...groups.values()].filter((group) => group.length > 1).map((group) => businessFinding(rule, plan, group, [token], 'UNIQUENESS_VIOLATION', `${token} appears on more than one record. Validate these master identifiers before any merge.`, sheet, createdAt))
    })
  }
  if (check.kind !== 'weighted_duplicate') return []
  if (check.threshold === undefined || !check.weights) throw new Error('Confirm the similarity threshold and weights before analysis.')
  if (rows.length * (rows.length - 1) / 2 > 5_000_000) throw new Error('Weighted duplicate review exceeds the 5,000,000-pair safety limit. Analyze a smaller dataset; no partial duplicate result has been returned.')
  const groups = new UnionFind()
  const values = rows.map((row) => Object.fromEntries([...new Set([...check.exactFields, ...check.weightedFields])].map((token) => [token, sourceValue(row, plan, token)])))
  const affected = new Map<number, Set<string>>()
  const scores = new Map<number, number>()
  for (let leftIndex = 0; leftIndex < rows.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < rows.length; rightIndex += 1) {
      const left = values[leftIndex]!
      const right = values[rightIndex]!
      const exact = check.exactFields.every((token) => Boolean(left[token]) && left[token] === right[token])
      const complete = check.weightedFields.every((token) => Boolean(left[token]) && Boolean(right[token]))
      const score = exact ? 1 : complete ? check.weightedFields.reduce((sum, token) => sum + calculateSimilarity(left[token]!, right[token]!, 'jaro_winkler') * check.weights![token]!, 0) : 0
      if (!exact && score + Number.EPSILON < check.threshold) continue
      const leftRow = rows[leftIndex]!
      const rightRow = rows[rightIndex]!
      groups.union(leftRow.rowNumber, rightRow.rowNumber)
      for (const row of [leftRow, rightRow]) {
        const fields = affected.get(row.rowNumber) ?? new Set<string>()
        for (const token of exact ? check.exactFields : check.weightedFields) fields.add(token)
        affected.set(row.rowNumber, fields)
        scores.set(row.rowNumber, Math.min(scores.get(row.rowNumber) ?? 1, score))
      }
    }
  }
  return groups.groups(new Map(rows.map((row) => [row.rowNumber, row]))).map((group) => {
    const tokens = [...new Set(group.flatMap((row) => [...affected.get(row.rowNumber)!]))]
    const finding = businessFinding(rule, plan, group, tokens, 'POSSIBLE_DUPLICATE', `Probable duplicate customers: normalized name/postal-code equality or configured weighted similarity of at least ${Math.round(check.threshold! * 100)}%. Validate before any governed merge.`, sheet, createdAt)
    finding.evidence = finding.evidence.filter((evidence) => [...affected.get(evidence.rowNumber)!].some((token) => plan.fields[token]?.columnKey === evidence.columnKey)).map((evidence) => ({ ...evidence, score: scores.get(evidence.rowNumber) }))
    return finding
  })
}
