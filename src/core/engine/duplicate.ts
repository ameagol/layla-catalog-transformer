import type { CompiledRule, DatasetRow, Finding, FindingConfidence } from '../model/domain'
import { calculateSimilarity } from '../matching/similarity'
import { isMissingValue } from '../normalization/normalizers'
import { createFindingId } from '../findings/factory'
import { NormalizationCache } from './normalizationCache'

interface DuplicateExecutionResult {
  findings: Finding[]
  warnings: string[]
}

export class UnionFind {
  private readonly parent = new Map<number, number>()

  add(value: number): void {
    if (!this.parent.has(value)) this.parent.set(value, value)
  }

  find(value: number): number {
    const parent = this.parent.get(value)
    if (parent === undefined || parent === value) return value
    const root = this.find(parent)
    this.parent.set(value, root)
    return root
  }

  union(left: number, right: number): void {
    this.add(left)
    this.add(right)
    const leftRoot = this.find(left)
    const rightRoot = this.find(right)
    if (leftRoot !== rightRoot) this.parent.set(rightRoot, leftRoot)
  }

  groups(rowsByNumber: Map<number, DatasetRow>): DatasetRow[][] {
    const grouped = new Map<number, DatasetRow[]>()
    for (const rowNumber of this.parent.keys()) {
      const root = this.find(rowNumber)
      const row = rowsByNumber.get(rowNumber)
      if (!row) continue
      const group = grouped.get(root) ?? []
      group.push(row)
      grouped.set(root, group)
    }
    return [...grouped.values()].filter((group) => group.length > 1)
  }
}

function groupExactMatches(
  rows: DatasetRow[],
  rule: CompiledRule,
  cache: NormalizationCache
): DatasetRow[][] {
  if (!rule.plan || rule.plan.kind !== 'duplicate') return []
  const rowsByNumber = new Map(rows.map((row) => [row.rowNumber, row]))

  if (rule.plan.logic === 'and') {
    const groups = new Map<string, DatasetRow[]>()
    for (const row of rows) {
      const values = rule.plan.matchers.map((matcher) => cache.get(row, matcher.field, matcher.normalizations))
      if (values.some((value) => !value)) continue
      const key = JSON.stringify(values)
      const group = groups.get(key) ?? []
      group.push(row)
      groups.set(key, group)
    }
    return [...groups.values()].filter((group) => group.length > 1)
  }

  const unionFind = new UnionFind()
  for (const matcher of rule.plan.matchers) {
    const groups = new Map<string, DatasetRow[]>()
    for (const row of rows) {
      const value = cache.get(row, matcher.field, matcher.normalizations)
      if (!value) continue
      const group = groups.get(value) ?? []
      group.push(row)
      groups.set(value, group)
    }
    for (const group of groups.values()) {
      if (group.length < 2) continue
      for (let index = 1; index < group.length; index += 1) {
        unionFind.union(group[0]?.rowNumber ?? 0, group[index]?.rowNumber ?? 0)
      }
    }
  }
  return unionFind.groups(rowsByNumber)
}

function createFuzzyBlocks(rows: DatasetRow[], rule: CompiledRule, cache: NormalizationCache): DatasetRow[][] {
  if (!rule.plan || rule.plan.kind !== 'duplicate') return []
  const exactMatchers = rule.plan.matchers.filter((matcher) => matcher.comparison === 'equals')

  if (exactMatchers.length === 0) {
    if (rows.length <= 5_000) return [rows]
    const similarityMatcher = rule.plan.matchers.find((matcher) => matcher.comparison === 'similarity')
    if (!similarityMatcher) return []
    const blocks = new Map<string, DatasetRow[]>()
    for (const row of rows) {
      const value = cache.get(row, similarityMatcher.field, similarityMatcher.normalizations)
      if (!value) continue
      const key = `${value.slice(0, 1)}:${Math.floor(value.length / 4)}`
      const block = blocks.get(key) ?? []
      block.push(row)
      blocks.set(key, block)
    }
    return [...blocks.values()]
  }

  const blocks = new Map<string, DatasetRow[]>()
  for (const row of rows) {
    const values = exactMatchers.map((matcher) => cache.get(row, matcher.field, matcher.normalizations))
    if (values.some((value) => !value)) continue
    const key = JSON.stringify(values)
    const block = blocks.get(key) ?? []
    block.push(row)
    blocks.set(key, block)
  }
  return [...blocks.values()]
}

function pairMatches(
  left: DatasetRow,
  right: DatasetRow,
  rule: CompiledRule,
  cache: NormalizationCache
): boolean {
  if (!rule.plan || rule.plan.kind !== 'duplicate') return false
  const matches = rule.plan.matchers.map((matcher) => {
    const leftValue = cache.get(left, matcher.field, matcher.normalizations)
    const rightValue = cache.get(right, matcher.field, matcher.normalizations)
    if (!leftValue || !rightValue) return false
    if (matcher.comparison === 'equals') return leftValue === rightValue
    const similarity = matcher.similarity
    return Boolean(similarity && calculateSimilarity(leftValue, rightValue, similarity.algorithm) >= similarity.threshold)
  })
  return rule.plan.logic === 'and' ? matches.every(Boolean) : matches.some(Boolean)
}

function groupFuzzyMatches(
  rows: DatasetRow[],
  rule: CompiledRule,
  cache: NormalizationCache
): { groups: DatasetRow[][]; warnings: string[] } {
  const blocks = createFuzzyBlocks(rows, rule, cache)
  const rowsByNumber = new Map(rows.map((row) => [row.rowNumber, row]))
  const unionFind = new UnionFind()
  const warnings: string[] = []
  let comparisons = 0
  const comparisonLimit = 2_000_000

  for (const block of blocks) {
    for (let leftIndex = 0; leftIndex < block.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < block.length; rightIndex += 1) {
        comparisons += 1
        if (comparisons > comparisonLimit) {
          warnings.push(`Fuzzy comparison stopped after ${comparisonLimit.toLocaleString()} candidate pairs. Add an exact blocking field such as phone or postal code.`)
          return { groups: unionFind.groups(rowsByNumber), warnings }
        }
        const left = block[leftIndex]
        const right = block[rightIndex]
        if (left && right && pairMatches(left, right, rule, cache)) {
          unionFind.union(left.rowNumber, right.rowNumber)
        }
      }
    }
  }

  return { groups: unionFind.groups(rowsByNumber), warnings }
}

function confidenceForRule(rule: CompiledRule): FindingConfidence {
  if (!rule.plan || rule.plan.kind !== 'duplicate') return 'LOW'
  const similarityCount = rule.plan.matchers.filter((matcher) => matcher.comparison === 'similarity').length
  const exactCount = rule.plan.matchers.length - similarityCount
  if (similarityCount === 0) return 'HIGH'
  return exactCount > 0 ? 'MEDIUM' : 'LOW'
}

function findingForGroup(
  group: DatasetRow[],
  rule: CompiledRule,
  sheetName: string,
  cache: NormalizationCache,
  createdAt: string
): Finding {
  if (!rule.plan || rule.plan.kind !== 'duplicate') {
    throw new Error('Duplicate finding requires a duplicate execution plan.')
  }

  const hasSimilarity = rule.plan.matchers.some((matcher) => matcher.comparison === 'similarity')
  const evidence = group.flatMap((row) =>
    rule.plan && rule.plan.kind === 'duplicate'
      ? rule.plan.matchers.map((matcher) => {
          const normalizedValue = cache.get(row, matcher.field, matcher.normalizations)
          const firstRow = group[0]
          const firstValue = firstRow ? cache.get(firstRow, matcher.field, matcher.normalizations) : normalizedValue
          const score =
            matcher.comparison === 'similarity' && matcher.similarity
              ? calculateSimilarity(firstValue, normalizedValue, matcher.similarity.algorithm)
              : 1
          return {
            rowNumber: row.rowNumber,
            columnKey: matcher.field.columnKey,
            columnHeader: matcher.field.columnHeader,
            originalValue: row.values[matcher.field.columnKey] ?? null,
            normalizedValue,
            comparator:
              matcher.comparison === 'similarity'
                ? `${matcher.similarity?.algorithm ?? 'similarity'} ≥ ${Math.round((matcher.similarity?.threshold ?? 0) * 100)}%`
                : 'normalized exact match',
            score
          }
        })
      : []
  )
  const rowNumbers = group.map((row) => row.rowNumber).sort((left, right) => left - right)
  const fields = rule.plan.matchers.map((matcher) => matcher.field.columnHeader)

  return {
    id: createFindingId(hasSimilarity ? 'POSSIBLE_DUPLICATE' : 'DUPLICATE', rule.id, rowNumbers),
    type: hasSimilarity ? 'POSSIBLE_DUPLICATE' : 'DUPLICATE',
    severity: rule.severity,
    confidence: confidenceForRule(rule),
    ruleId: rule.id,
    ruleText: rule.sourceText,
    sheet: sheetName,
    rowNumbers,
    fields,
    evidence,
    explanation: `Rows ${rowNumbers.join(', ')} satisfy the ${rule.plan.logic.toUpperCase()} comparison across ${fields.join(', ')} after deterministic normalization.`,
    suggestedAction: 'Review the grouped source rows and merge or retain them according to the business record policy.',
    createdAt
  }
}

export function executeDuplicateRule(
  rows: DatasetRow[],
  rule: CompiledRule,
  sheetName: string,
  cache: NormalizationCache,
  createdAt: string
): DuplicateExecutionResult {
  if (!rule.plan || rule.plan.kind !== 'duplicate' || rule.plan.matchers.length === 0) {
    return { findings: [], warnings: [] }
  }

  const hasSimilarity = rule.plan.matchers.some((matcher) => matcher.comparison === 'similarity')
  const result = hasSimilarity ? groupFuzzyMatches(rows, rule, cache) : { groups: groupExactMatches(rows, rule, cache), warnings: [] }

  return {
    findings: result.groups.map((group) => findingForGroup(group, rule, sheetName, cache, createdAt)),
    warnings: result.warnings
  }
}
