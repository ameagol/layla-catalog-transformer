import type { CellValue, ColumnProfile, DataType, DatasetColumn, DatasetRow, WorksheetProfile } from '../model/domain'
import { inferSemanticCandidates, phoneFormatPattern, selectSemanticType } from './columnInference'
import { isMissingValue, stringifyCellValue } from '../normalization/normalizers'

function detectDataType(values: CellValue[]): DataType {
  const nonEmpty = values.filter((value) => !isMissingValue(value))

  if (nonEmpty.length === 0) {
    return 'empty'
  }

  const types = new Set(
    nonEmpty.map((value) => {
      if (value instanceof Date) return 'date'
      if (typeof value === 'number') return 'number'
      if (typeof value === 'boolean') return 'boolean'
      return 'text'
    })
  )

  return types.size === 1 ? ([...types][0] as DataType) : 'mixed'
}

function createColumnProfile(column: DatasetColumn, rows: DatasetRow[]): ColumnProfile {
  const values = rows.map((row) => row.values[column.key] ?? null)
  const nonEmptyValues = values.filter((value) => !isMissingValue(value))
  const normalizedUniqueValues = new Set(nonEmptyValues.map((value) => stringifyCellValue(value).trim()))
  const examples = [...normalizedUniqueValues].slice(0, 5)
  const semanticCandidates = inferSemanticCandidates(column.header, nonEmptyValues)
  const semanticSelection = selectSemanticType(semanticCandidates)
  const formatVariants = [...new Set(nonEmptyValues.slice(0, 250).map(phoneFormatPattern))].slice(0, 12)

  return {
    ...column,
    dataType: detectDataType(values),
    semanticType: semanticSelection.semanticType,
    semanticConfidence: semanticSelection.confidence,
    semanticCandidates,
    nonEmptyCount: nonEmptyValues.length,
    missingCount: values.length - nonEmptyValues.length,
    missingRate: values.length === 0 ? 0 : (values.length - nonEmptyValues.length) / values.length,
    uniqueCount: normalizedUniqueValues.size,
    uniquenessRatio: nonEmptyValues.length === 0 ? 0 : normalizedUniqueValues.size / nonEmptyValues.length,
    examples,
    formatVariants
  }
}

export function profileWorksheet(
  name: string,
  headerRow: number,
  columns: DatasetColumn[],
  rows: DatasetRow[],
  warnings: string[] = []
): WorksheetProfile {
  const profiledColumns = columns.map((column) => createColumnProfile(column, rows))
  const profileWarnings = [...warnings]

  if (rows.length === 0) {
    profileWarnings.push('The selected worksheet contains headers but no data rows.')
  }

  if (profiledColumns.every((column) => column.semanticType === 'unknown')) {
    profileWarnings.push('No columns could be identified confidently. Review column mappings before analysis.')
  }

  return {
    name,
    rowCount: rows.length,
    columnCount: columns.length,
    headerRow,
    columns: profiledColumns,
    warnings: profileWarnings
  }
}

