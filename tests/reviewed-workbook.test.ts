import ExcelJS from 'exceljs'
import { describe, expect, it } from 'vitest'

import { rowActionItems, findingAffectsCell } from '../src/core/findings/rowActions'
import { summarizeRowReview } from '../src/core/findings/review'
import type { DatasetColumn, DatasetRow, Finding } from '../src/core/model/domain'
import { reviewedDatasetWorkbook, REVIEW_EXPORT_COLORS } from '../src/main/services/reviewedWorkbook'
import { createFinding } from './finding-fixtures'

const columns: DatasetColumn[] = ['ID', 'Name', 'Email', 'Notes'].map((header, index) => ({ key: header.toLowerCase(), header, index }))
const rows: DatasetRow[] = [
  { rowNumber: 2, values: { id: 0, name: 'Accepted', email: 'duplicate@example.test', notes: '=SUM(1,2)' } },
  { rowNumber: 3, values: { id: 1, name: '', email: 'duplicate@example.test', notes: 'Excluded' } },
  { rowNumber: 4, values: { id: 2, name: '', email: 'pending@example.test', notes: 'Unreviewed' } },
  { rowNumber: 5, values: { id: 3, name: 'Clean', email: 'clean@example.test', notes: 'Unchanged' } }
]
const findings: Finding[] = [
  createFinding({ id: 'duplicate', ruleId: 'duplicate-rule', rowNumbers: [2, 3], fields: ['Email'], priority: 'high', evidence: [2, 3].map((rowNumber) => ({ rowNumber, columnKey: 'email', columnHeader: 'Email', originalValue: 'duplicate@example.test', normalizedValue: 'duplicate@example.test', comparator: 'equals' })), suggestedAction: 'Route to the Master Data Steward.' }),
  createFinding({ id: 'missing', ruleId: 'missing-rule', type: 'MISSING', rowNumbers: [3, 4], fields: ['Name'], evidence: [], priority: 'medium', suggestedAction: 'Route to the Account Owner to supply the name.' })
]

async function exported(accepted: number[]) {
  const workbook = reviewedDatasetWorkbook(columns, rows, findings, accepted)
  const reopened = new ExcelJS.Workbook()
  await reopened.xlsx.load(await workbook.xlsx.writeBuffer())
  return reopened.worksheets[0]!
}

describe('accepted-row workbook and shared action projection', () => {
  it('orders mixed priority ranges correctly instead of treating medium/high as high', () => {
    const prioritized = ['medium_high', 'low_medium', 'high', 'medium', 'low'] as const
    const result = rowActionItems(prioritized.map((priority, index) => createFinding({ ruleId: `rule-${index}`, rowNumbers: [2], priority })), 2)
    expect(result.map((item) => item.priority)).toEqual(['high', 'medium_high', 'medium', 'low_medium', 'low'])
  })
  it('preserves coverage warnings in a separate worksheet after XLSX round-trip', async () => {
    const original = reviewedDatasetWorkbook(columns, rows, findings, [2], ['Country/state compatibility was not checked for BR.'])
    const reopened = new ExcelJS.Workbook()
    await reopened.xlsx.load(await original.xlsx.writeBuffer())
    expect(reopened.getWorksheet('Analysis notes')?.getCell('A2').value).toBe('Country/state compatibility was not checked for BR.')
  })
  it('round-trips all original columns, accepted findings and clean rows; pending and excluded rows are absent', async () => {
    const original = structuredClone(rows)
    const sheet = await exported([2])
    expect(sheet.rowCount).toBe(3)
    expect(sheet.getRow(1).values).toEqual([undefined, 'ID', 'Name', 'Email', 'Notes', 'Action items', 'Priority', 'Detected issues', 'Source row'])
    expect(sheet.getRow(2).getCell(1).value).toBe(0)
    expect(sheet.getRow(2).getCell(8).value).toBe(2)
    expect(sheet.getRow(3).getCell(8).value).toBe(5)
    expect(sheet.getRow(2).getCell(4).value).toBe('=SUM(1,2)')
    expect(sheet.getRow(2).getCell(4).type).toBe(ExcelJS.ValueType.String)
    expect(rows).toEqual(original)
  })

  it('marks only affected cells red after reopening the xlsx and never clears accepted issues', async () => {
    const sheet = await exported([3])
    expect(sheet.getRow(2).getCell(2).fill).toMatchObject({ type: 'pattern', fgColor: { argb: REVIEW_EXPORT_COLORS.errorFill } })
    expect(sheet.getRow(2).getCell(3).font.color?.argb).toBe(REVIEW_EXPORT_COLORS.errorText)
    expect(sheet.getRow(2).getCell(1).fill).not.toMatchObject({ fgColor: { argb: REVIEW_EXPORT_COLORS.errorFill } })
    expect(sheet.getRow(3).getCell(3).fill).not.toMatchObject({ fgColor: { argb: REVIEW_EXPORT_COLORS.errorFill } })
    expect(sheet.getRow(2).getCell(5).value).toBe('Route to the Master Data Steward.\nRoute to the Account Owner to supply the name.')
    expect(sheet.getRow(2).getCell(6).value).toBe('High')
    expect(sheet.getRow(3).getCell(5).value).toBe('')
  })

  it('does not accept flagged rows implicitly, including after a new analysis', async () => {
    const sheet = await exported([])
    expect(sheet.rowCount).toBe(2)
    expect(sheet.getRow(2).getCell(8).value).toBe(5)
    expect(summarizeRowReview(findings, rows.length, { analysisId: 'old', decisions: { 2: 'accept' } }, 'new')).toEqual({ accepted: 0, excluded: 0, unreviewed: 3, clean: 1 })
    expect(summarizeRowReview(findings, rows.length, { analysisId: 'new', decisions: { 2: 'accept', 3: 'delete' } }, 'new')).toEqual({ accepted: 1, excluded: 1, unreviewed: 1, clean: 1 })
  })

  it('deduplicates per-rule actions and does not leak neighboring-row actions or error colors', () => {
    expect(rowActionItems([...findings, findings[0]!], 2)).toHaveLength(1)
    expect(rowActionItems(findings, 3)).toHaveLength(2)
    const evidence = createFinding({ rowNumbers: [2, 3], fields: ['Name', 'Email'], evidence: [{ rowNumber: 2, columnKey: 'email', columnHeader: 'Email', originalValue: '', normalizedValue: '', comparator: 'required' }, { rowNumber: 3, columnKey: 'name', columnHeader: 'Name', originalValue: '', normalizedValue: '', comparator: 'required' }] })
    expect(findingAffectsCell(evidence, 2, columns[1]!)).toBe(false)
    expect(findingAffectsCell(evidence, 3, columns[1]!)).toBe(true)
  })

  it('keeps the whole dataset when there are no findings and avoids metadata-header collisions', () => {
    const workbook = reviewedDatasetWorkbook([...columns, { key: 'actions', header: 'Action items', index: 4 }], rows, [], [])
    const sheet = workbook.worksheets[0]!
    expect(sheet.rowCount).toBe(rows.length + 1)
    expect(sheet.getRow(1).getCell(6).value).toBe('Action items (review 1)')
    expect(sheet.views[0]).toMatchObject({ state: 'frozen', ySplit: 1 })
    expect(sheet.autoFilter).toBeTruthy()
  })
})
