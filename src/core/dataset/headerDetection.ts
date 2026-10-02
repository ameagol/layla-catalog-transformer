import type { CellValue, DatasetColumn } from '../model/domain'
import { isMissingValue, stringifyCellValue } from '../normalization/normalizers'

function scoreHeaderCandidate(row: CellValue[], nextRow: CellValue[] | undefined): number {
  const nonEmpty = row.filter((value) => !isMissingValue(value))

  if (nonEmpty.length === 0) {
    return Number.NEGATIVE_INFINITY
  }

  const normalizedValues = nonEmpty.map((value) => stringifyCellValue(value).trim().toLocaleLowerCase('en-US'))
  const uniqueRatio = new Set(normalizedValues).size / normalizedValues.length
  const textRatio = nonEmpty.filter((value) => typeof value === 'string').length / nonEmpty.length
  const nextRowDensity = nextRow
    ? nextRow.filter((value) => !isMissingValue(value)).length / Math.max(row.length, 1)
    : 0
  const duplicatePenalty = normalizedValues.length - new Set(normalizedValues).size

  return nonEmpty.length * 2 + uniqueRatio * 4 + textRatio * 3 + nextRowDensity * 2 - duplicatePenalty * 2
}

export function detectHeaderRow(matrix: CellValue[][], scanLimit = 20): number {
  const limit = Math.min(matrix.length, scanLimit)
  let bestIndex = 0
  let bestScore = Number.NEGATIVE_INFINITY

  for (let index = 0; index < limit; index += 1) {
    const score = scoreHeaderCandidate(matrix[index] ?? [], matrix[index + 1])

    if (score > bestScore) {
      bestIndex = index
      bestScore = score
    }
  }

  return bestIndex + 1
}

function headerKey(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .toLocaleLowerCase('en-US')
    .replace(/[^a-z0-9]+/gu, '_')
    .replace(/^_+|_+$/gu, '')
}

export function createDatasetColumns(headerValues: CellValue[]): { columns: DatasetColumn[]; warnings: string[] } {
  const counts = new Map<string, number>()
  const warnings: string[] = []
  const columns = headerValues.map((value, index) => {
    const rawHeader = stringifyCellValue(value).trim()
    const header = rawHeader || `Column ${index + 1}`
    const baseKey = headerKey(header) || `column_${index + 1}`
    const count = (counts.get(baseKey) ?? 0) + 1
    counts.set(baseKey, count)

    if (!rawHeader) {
      warnings.push(`Column ${index + 1} has no header and was named “${header}”.`)
    } else if (count > 1) {
      warnings.push(`Duplicate header “${header}” was disambiguated as occurrence ${count}.`)
    }

    return {
      key: count === 1 ? baseKey : `${baseKey}_${count}`,
      header: count === 1 ? header : `${header} (${count})`,
      index
    }
  })

  return { columns, warnings }
}

