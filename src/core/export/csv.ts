import type { CellValue, DatasetColumn, DatasetRow } from '../model/domain'
import { stringifyCellValue } from '../normalization/normalizers'

export function csvCell(value: CellValue): string {
  const original = stringifyCellValue(value)
  const text = typeof value === 'string' && (/^\s*[=+\-@]/u.test(original) || /^[\t\r\n]/u.test(original))
    ? `'${original}`
    : original
  return /[",\r\n]/u.test(text) ? `"${text.replace(/"/gu, '""')}"` : text
}

export function correctedDatasetCsv(columns: readonly DatasetColumn[], rows: readonly DatasetRow[], deletedRowNumbers: readonly number[]): string {
  const excluded = new Set(deletedRowNumbers)
  const orderedColumns = [...columns].sort((left, right) => left.index - right.index)
  const lines = [orderedColumns.map((column) => csvCell(column.header)).join(',')]
  for (const row of rows) {
    if (!excluded.has(row.rowNumber)) {
      lines.push(orderedColumns.map((column) => csvCell(row.values[column.key] ?? null)).join(','))
    }
  }
  return `\uFEFF${lines.join('\r\n')}\r\n`
}
