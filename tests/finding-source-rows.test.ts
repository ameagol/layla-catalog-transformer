import { describe, expect, it } from 'vitest'

import { buildFindingSourceRows, FINDING_ROWS_PAGE_SIZE } from '../src/core/findings/sourceRows'
import { findingRowsInputSchema } from '../src/core/ipc/schemas'
import { createFinding, findingColumns, findingRows } from './finding-fixtures'

describe('finding source rows', () => {
  it('always includes the first two worksheet columns, followed by affected columns in workbook order', () => {
    const source = buildFindingSourceRows(createFinding(), findingColumns, findingRows)
    expect(source.columns).toEqual([
      { key: 'id', header: 'ID', index: 0, affected: false },
      { key: 'name', header: 'Name', index: 1, affected: false },
      { key: 'phone', header: 'Phone', index: 10, affected: true }
    ])
    expect(source.rows[0]?.values).toEqual({ id: 0, name: 'Customer A', phone: '11 - 20209090' })
    expect(source.rows[1]?.values.phone).toBe('(11) 2020-9090')
    expect(source.rows[0]?.values).not.toHaveProperty('notes')
  })

  it('does not duplicate context columns when they are affected', () => {
    const finding = createFinding({ fields: ['ID', 'Name'], evidence: [] })
    const source = buildFindingSourceRows(finding, findingColumns, findingRows)
    expect(source.columns.map((column) => [column.key, column.affected])).toEqual([['id', true], ['name', true]])
  })

  it('retains an affected field without evidence and works with a one-column worksheet', () => {
    const finding = createFinding({ fields: ['Email'], evidence: [], rowNumbers: [204] })
    const source = buildFindingSourceRows(finding, [{ key: 'email', header: 'Email', index: 0 }], findingRows)
    expect(source.columns).toEqual([{ key: 'email', header: 'Email', index: 0, affected: true }])
    expect(source.rows[0]?.values).toEqual({ email: null })
  })

  it('returns only affected rows, sorted without mutating the source or finding', () => {
    const finding = createFinding({ rowNumbers: [204, 2, 204] })
    const rows = [...findingRows].reverse().concat({ rowNumber: 9, values: { id: 'unrelated' } })
    const source = buildFindingSourceRows(finding, findingColumns, rows)
    expect(source.rows.map((row) => row.rowNumber)).toEqual([2, 204])
    expect(source.totalRows).toBe(2)
    expect(finding.rowNumbers).toEqual([204, 2, 204])
    expect(rows[0]?.rowNumber).toBe(204)
    expect(findingColumns[0]?.index).toBe(10)
  })

  it('pages large groups without losing context after row 20 or truncating original values', () => {
    const rows = Array.from({ length: 75 }, (_, index) => ({
      rowNumber: index + 2, values: { id: index, name: false, phone: '1'.repeat(400) }
    }))
    const finding = createFinding({ rowNumbers: rows.map((row) => row.rowNumber) })
    const first = buildFindingSourceRows(finding, findingColumns, rows)
    const next = buildFindingSourceRows(finding, findingColumns, rows, FINDING_ROWS_PAGE_SIZE)
    expect(first.rows).toHaveLength(50)
    expect(next.rows).toHaveLength(25)
    expect(next).toMatchObject({ offset: 50, totalRows: 75 })
    expect(next.rows[0]).toEqual({ rowNumber: 52, values: { id: 50, name: false, phone: '1'.repeat(400) } })
    expect(new Set([...first.rows, ...next.rows].map((row) => row.rowNumber)).size).toBe(75)
  })

  it('reports unavailable source rows instead of displaying invented blank context', () => {
    expect(() => buildFindingSourceRows(createFinding(), findingColumns, [])).toThrow('Some source rows are unavailable')
  })

  it('validates the analysis, finding and page offset at the IPC boundary', () => {
    const input = { analysisId: '00000000-0000-4000-8000-000000000001', findingId: 'finding-abc123' }
    expect(findingRowsInputSchema.parse(input).offset).toBe(0)
    for (const offset of [-1, 0.5, Infinity]) {
      expect(findingRowsInputSchema.safeParse({ ...input, offset }).success).toBe(false)
    }
    expect(findingRowsInputSchema.safeParse({ ...input, analysisId: 'not-an-id' }).success).toBe(false)
    expect(findingRowsInputSchema.safeParse({ ...input, findingId: '../file' }).success).toBe(false)
  })
})
