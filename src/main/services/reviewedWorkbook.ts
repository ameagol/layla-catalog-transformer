import ExcelJS from 'exceljs'

import type { DatasetColumn, DatasetRow, Finding } from '@core/model/domain'
import { findingAffectsCell, rowActionItems } from '@core/findings/rowActions'
import { PRIORITY_LABELS, impactPriority } from '@core/rules/metadata'

export const REVIEW_EXPORT_COLORS = { header: 'FF173C3A', headerText: 'FFFFFFFF', errorFill: 'FFFEE2E2', errorText: 'FF991B1B' } as const

function metadataHeaders(columns: readonly DatasetColumn[]): string[] {
  const used = new Set(columns.map((column) => column.header.toLowerCase()))
  return ['Action items', 'Priority', 'Detected issues', 'Source row'].map((label) => {
    let header = label
    let suffix = 1
    while (used.has(header.toLowerCase())) header = `${label} (review ${suffix++})`
    used.add(header.toLowerCase())
    return header
  })
}

export function reviewedDatasetWorkbook(columns: readonly DatasetColumn[], rows: readonly DatasetRow[], findings: readonly Finding[], acceptedRowNumbers: readonly number[], warnings: readonly string[] = []): ExcelJS.Workbook {
  const accepted = new Set(acceptedRowNumbers)
  const byRow = new Map<number, Finding[]>()
  for (const finding of findings) {
    for (const rowNumber of finding.rowNumbers) {
      const group = byRow.get(rowNumber) ?? []
      group.push(finding)
      byRow.set(rowNumber, group)
    }
  }
  const orderedColumns = [...columns].sort((left, right) => left.index - right.index)
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Catalog Transformer'
  const sheet = workbook.addWorksheet('Accepted rows', { views: [{ state: 'frozen', xSplit: Math.min(2, columns.length), ySplit: 1 }] })
  const headers = [...orderedColumns.map((column) => column.header), ...metadataHeaders(orderedColumns)]
  const header = sheet.addRow(headers)
  header.font = { bold: true, color: { argb: REVIEW_EXPORT_COLORS.headerText } }
  header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: REVIEW_EXPORT_COLORS.header } }
  header.height = 28
  sheet.columns.forEach((column, index) => {
    column.width = index < orderedColumns.length ? Math.max(16, Math.min(32, headers[index]!.length + 4)) : index === orderedColumns.length || index === orderedColumns.length + 2 ? 72 : 20
  })
  for (const source of rows) {
    const matches = byRow.get(source.rowNumber) ?? []
    if (matches.length && !accepted.has(source.rowNumber)) continue
    const actions = rowActionItems(matches, source.rowNumber)
    const actionText = [...new Set(actions.map((item) => item.actionItem))].join('\n')
    const issueText = actions.map((item) => `[${PRIORITY_LABELS[item.priority]}] ${item.explanation}`).join('\n')
    if (actionText.length > 32_767 || issueText.length > 32_767) throw new Error(`Review text for source row ${source.rowNumber} exceeds Excel's cell text limit. Reduce the rule action text before exporting.`)
    const output = sheet.addRow([...orderedColumns.map((column) => source.values[column.key] ?? null), actionText, actions[0] ? PRIORITY_LABELS[actions[0].priority] : '', issueText, source.rowNumber])
    output.alignment = { vertical: 'top', wrapText: true }
    if (actions.length) output.height = Math.min(240, Math.max(48, actions.length * 44))
    orderedColumns.forEach((column, index) => {
      const cell = output.getCell(index + 1)
      if (source.values[column.key] instanceof Date) cell.numFmt = 'yyyy-mm-dd hh:mm:ss'
      if (matches.some((finding) => findingAffectsCell(finding, source.rowNumber, column))) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: REVIEW_EXPORT_COLORS.errorFill } }
        cell.font = { color: { argb: REVIEW_EXPORT_COLORS.errorText } }
      }
    })
  }
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: Math.max(1, sheet.rowCount), column: headers.length } }
  const worksheetIssues = findings.filter((finding) => finding.scope === 'worksheet')
  if (worksheetIssues.length) {
    const issues = workbook.addWorksheet('Worksheet issues', { views: [{ state: 'frozen', ySplit: 1 }] })
    const issueHeader = issues.addRow(['Worksheet', 'Missing column', 'Priority', 'Detected issue', 'Action item', 'Rule'])
    issueHeader.font = { bold: true, color: { argb: REVIEW_EXPORT_COLORS.headerText } }
    issueHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: REVIEW_EXPORT_COLORS.header } }
    issueHeader.height = 28
    issues.columns.forEach((column, index) => { column.width = index < 3 ? 24 : 72 })
    for (const finding of worksheetIssues) {
      const values = [finding.sheet, finding.fields.join(', '), PRIORITY_LABELS[finding.priority ?? impactPriority(finding.impactLevel ?? 'medium')], finding.explanation, finding.suggestedAction, finding.ruleText]
      if (values.some((value) => value.length > 32_767)) throw new Error('Worksheet-issue text exceeds Excel’s cell text limit. Shorten the rule or action before exporting.')
      const row = issues.addRow(values)
      row.alignment = { vertical: 'top', wrapText: true }
      row.height = 80
      row.getCell(2).font = { color: { argb: REVIEW_EXPORT_COLORS.errorText } }
      row.getCell(2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: REVIEW_EXPORT_COLORS.errorFill } }
    }
    issues.autoFilter = { from: { row: 1, column: 1 }, to: { row: issues.rowCount, column: 6 } }
  }
  if (warnings.length) {
    const notes = workbook.addWorksheet('Analysis notes')
    notes.getColumn(1).width = 110
    notes.addRow(['Coverage warnings']).font = { bold: true }
    for (const warning of [...new Set(warnings)]) {
      const row = notes.addRow([warning])
      row.alignment = { vertical: 'top', wrapText: true }
      row.height = 48
    }
  }
  return workbook
}
