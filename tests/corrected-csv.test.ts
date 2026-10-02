import { describe, expect, it } from 'vitest'

import { correctedDatasetCsv, csvCell } from '../src/core/export/csv'
import { deletedRowsForReview } from '../src/core/findings/review'
import { correctedCsvInputSchema } from '../src/core/ipc/schemas'
import { findingColumns, findingRows } from './finding-fixtures'

const analysisId = '00000000-0000-4000-8000-000000000110'

describe('corrected dataset CSV', () => {
  it('exports every column in worksheet order and excludes only deleted source rows', () => {
    expect(correctedDatasetCsv(findingColumns, findingRows, [204])).toBe(
      '\uFEFFID,Name,Email,Internal notes,Phone\r\n0,Customer A,a@example.test,Unrelated data,11 - 20209090\r\n'
    )
    expect(findingRows).toHaveLength(2)
    expect(findingColumns[0]?.key).toBe('phone')
  })

  it('retains unreviewed rows and original phone formatting instead of normalizing source values', () => {
    const csv = correctedDatasetCsv(findingColumns, findingRows, [])
    expect(csv).toContain('204,Customer B,,More unrelated data,(11) 2020-9090\r\n')
    expect(csv).not.toContain('1120209090')
  })

  it('keeps the header when there are no rows or all rows are deleted', () => {
    const header = '\uFEFFID,Name,Email,Internal notes,Phone\r\n'
    expect(correctedDatasetCsv(findingColumns, [], [])).toBe(header)
    expect(correctedDatasetCsv(findingColumns, findingRows, [2, 204])).toBe(header)
  })

  it('escapes separators, quotes and multiline text and retains non-string cell values', () => {
    expect(csvCell('Ána, "One"\nTwo')).toBe('"Ána, ""One""\nTwo"')
    expect(csvCell(null)).toBe('')
    expect(csvCell(0)).toBe('0')
    expect(csvCell(false)).toBe('false')
    expect(csvCell(new Date('2026-10-01T00:00:00Z'))).toBe('2026-10-01T00:00:00.000Z')
  })

  it('neutralizes formula-like text without converting actual negative numbers to text', () => {
    for (const value of ['=1+1', '+command', '-command', '@command', '  =1+1', '\tcommand']) {
      expect(csvCell(value)).toBe(`'${value}`)
    }
    expect(csvCell(-42)).toBe('-42')
  })
})

describe('row review export selection', () => {
  it('exports only Delete decisions from the current analysis', () => {
    const review = { analysisId, decisions: { 204: 'delete', 2: 'accept', 3: 'delete' } } as const
    expect(deletedRowsForReview(review, analysisId)).toEqual([3, 204])
    expect(deletedRowsForReview(review, 'another-analysis')).toEqual([])
    expect(deletedRowsForReview(null, analysisId)).toEqual([])
  })

  it('rejects malformed or duplicate row numbers at the IPC boundary', () => {
    expect(correctedCsvInputSchema.parse({ analysisId, deletedRowNumbers: [] }).deletedRowNumbers).toEqual([])
    for (const deletedRowNumbers of [[0], [-1], [2.5], [2, 2], [1_100_001], ['2']]) {
      expect(correctedCsvInputSchema.safeParse({ analysisId, deletedRowNumbers }).success).toBe(false)
    }
    expect(correctedCsvInputSchema.safeParse({ analysisId: 'old', deletedRowNumbers: [] }).success).toBe(false)
  })
})
