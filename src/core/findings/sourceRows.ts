import type { DatasetColumn, DatasetRow, Finding, FindingSourceRows } from '../model/domain'

export const FINDING_ROWS_PAGE_SIZE = 50

export function buildFindingSourceRows(
  finding: Pick<Finding, 'rowNumbers' | 'fields' | 'evidence'>,
  columns: readonly DatasetColumn[],
  rows: readonly DatasetRow[],
  offset = 0
): FindingSourceRows {
  const affectedKeys = new Set(finding.evidence.map((evidence) => evidence.columnKey))
  const affectedFields = new Set(finding.fields)
  const visibleColumns = [...columns]
    .sort((left, right) => left.index - right.index)
    .flatMap((column, position) => {
      const affected = affectedKeys.has(column.key) || affectedFields.has(column.header) || affectedFields.has(column.key)
      return position < 2 || affected ? [{ key: column.key, header: column.header, index: column.index, affected }] : []
    })
  const rowNumbers = [...new Set(finding.rowNumbers)].sort((left, right) => left - right)
  const pageNumbers = new Set(rowNumbers.slice(offset, offset + FINDING_ROWS_PAGE_SIZE))
  const pageRows = rows
    .filter((row) => pageNumbers.has(row.rowNumber))
    .sort((left, right) => left.rowNumber - right.rowNumber)
    .map((row) => ({
      rowNumber: row.rowNumber,
      values: Object.fromEntries(visibleColumns.map((column) => [column.key, row.values[column.key] ?? null]))
    }))

  if (pageRows.length !== pageNumbers.size) {
    throw new Error('Some source rows are unavailable. Reload the workbook and run the analysis again.')
  }

  return { columns: visibleColumns, rows: pageRows, offset, totalRows: rowNumbers.length }
}
