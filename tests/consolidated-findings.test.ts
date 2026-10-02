import { describe, expect, it } from 'vitest'

import { consolidateFindings } from '../src/core/findings/consolidate'
import { buildFindingSourceRows } from '../src/core/findings/sourceRows'
import { buildSourceRowView, filterFindingGroups } from '../src/renderer/src/features/findings/helper'
import { createFinding, findingColumns, findingRows } from './finding-fixtures'

describe('consolidated finding review', () => {
  it('merges duplicate and missing rules for overlapping rows with all unique badges', () => {
    const duplicate = createFinding({ impactLevel: 'small' })
    const missing = createFinding({ id: 'finding-email', type: 'MISSING', rowNumbers: [2], fields: ['Email'], evidence: [], impactLevel: 'large' })
    const anotherMissing = createFinding({ ...missing, id: 'finding-emailagain', impactLevel: 'medium' })
    const groups = consolidateFindings([duplicate, missing, anotherMissing])
    expect(groups).toHaveLength(1)
    expect(groups[0]).toMatchObject({ id: missing.id, rowNumbers: [2, 204], types: ['MISSING', 'DUPLICATE'], impactLevel: 'large' })
    expect(groups[0]?.findings).toHaveLength(3)
    expect(groups[0]?.fields).toEqual(['Email', 'Phone'])
    expect(duplicate.rowNumbers).toEqual([2, 204])
  })

  it('merges transitively without ever listing a source row in two review items', () => {
    const findings = [
      createFinding({ id: 'finding-first', rowNumbers: [2, 3] }),
      createFinding({ id: 'finding-second', type: 'INVALID', rowNumbers: [4, 5] }),
      createFinding({ id: 'finding-third', type: 'MISSING', rowNumbers: [3, 4] }),
      createFinding({ id: 'finding-separate', rowNumbers: [9] })
    ]
    const groups = consolidateFindings(findings)
    expect(groups.map((group) => group.rowNumbers)).toEqual([[2, 3, 4, 5], [9]])
    expect(groups[0]?.types).toEqual(['DUPLICATE', 'INVALID', 'MISSING'])
  })

  it('keeps different worksheets and non-overlapping rows separate, sorted by highest impact', () => {
    const findings = [
      createFinding({ id: 'finding-low', impactLevel: 'small', rowNumbers: [2] }),
      createFinding({ id: 'finding-other', impactLevel: 'large', rowNumbers: [2], sheet: 'Another sheet' }),
      createFinding({ id: 'finding-medium', rowNumbers: [5] })
    ]
    expect(consolidateFindings(findings).map((group) => group.id)).toEqual(['finding-other', 'finding-medium', 'finding-low'])
  })

  it('projects columns from every rule while keeping the first two context columns', () => {
    const group = consolidateFindings([
      createFinding(),
      createFinding({ id: 'finding-email', type: 'MISSING', rowNumbers: [204], fields: ['Email'], evidence: [] })
    ])[0]!
    const source = buildFindingSourceRows(group, findingColumns, findingRows)
    expect(source.columns.map((column) => column.key)).toEqual(['id', 'name', 'email', 'phone'])
    const view = buildSourceRowView(source, group)
    expect(view[0]?.cells.find((cell) => cell.columnKey === 'email')?.affected).toBe(false)
    expect(view[1]?.cells.find((cell) => cell.columnKey === 'email')?.affected).toBe(true)
    expect(view[0]?.cells.find((cell) => cell.columnKey === 'phone')?.normalized).toBe('1120209090')
  })

  it('filtering one badge preserves all the other badges and rows in the same consolidated finding', () => {
    const groups = consolidateFindings([
      createFinding(),
      createFinding({ id: 'finding-email', type: 'MISSING', rowNumbers: [204] })
    ])
    const filtered = filterFindingGroups(groups, { search: '', type: 'MISSING', severity: 'all', confidence: 'all' })
    expect(filtered).toEqual(groups)
    expect(filtered[0]?.types).toEqual(['DUPLICATE', 'MISSING'])
    expect(filtered[0]?.rowNumbers).toEqual([2, 204])
  })

  it('handles empty input and large connected groups without recursive traversal', () => {
    expect(consolidateFindings([])).toEqual([])
    const groups = consolidateFindings(Array.from({ length: 10_000 }, (_, index) => createFinding({ id: `finding-${index}`, rowNumbers: [index + 2, index + 3], evidence: [] })))
    expect(groups).toHaveLength(1)
    expect(groups[0]?.rowNumbers).toHaveLength(10_001)
  })
})
