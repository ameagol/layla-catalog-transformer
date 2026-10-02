import type { DatasetColumn, DatasetRow } from '../model/domain'
import { isMissingValue, stringifyCellValue } from '../normalization/normalizers'
import type { DetectedAnomaly } from './types'

/**
 * Universal Data Invariants for Missingness:
 * 1. Unconditional Completeness (Universal Requirement):
 *    If a column is populated in >= 95% of rows across the whole sheet and misses in only <= 5% (1 to 20 rows),
 *    it is an essential data attribute with isolated data entry omissions.
 * 2. Low-Entropy Status Dependency:
 *    Only columns that act as finite discrete states (entropy <= 3 bits, <= 4 distinct values, e.g. Active/Inactive, Draft/Approved)
 *    and NEVER personal identifiers, emails, names, or unbounded strings.
 */
export function detectAtypicalNulls(
  columns: DatasetColumn[],
  rows: DatasetRow[]
): DetectedAnomaly[] {
  if (rows.length < 10 || columns.length < 2) return []

  const anomalies: DetectedAnomaly[] = []

  // Invariant 1: Universal High-Completeness Column
  for (const col of columns) {
    let populatedCount = 0
    const missingRows: number[] = []

    for (const row of rows) {
      const val = row.values[col.key] ?? null
      if (!isMissingValue(val) && String(val).trim() !== '') {
        populatedCount++
      } else {
        missingRows.push(row.rowNumber)
      }
    }

    const overallRate = populatedCount / rows.length
    // Invariant: Populated in >= 95% of rows and missing in <= 5% (and at least 1 row missing)
    if (overallRate >= 0.95 && overallRate < 1.0 && missingRows.length > 0 && missingRows.length <= 25) {
      for (const rowNum of missingRows) {
        anomalies.push({
          id: `anom_null_gen_${col.key}_${rowNum}`,
          category: 'ATYPICAL_MISSING',
          method: 'null_correlation',
          severity: 'warning',
          confidence: 'HIGH',
          score: Math.round(overallRate * 100) / 100,
          columnKey: col.key,
          columnHeader: col.header,
          rowNumbers: [rowNum],
          value: null,
          baseline: {
            dominantCoverage: Math.round(overallRate * 100) / 100
          },
          explanation: `Field '${col.header}' is missing, although it is populated in ${(overallRate * 100).toFixed(1)}% of all rows.`,
          actionableSuggestion: {
            type: 'request_data',
            label: `Ensure '${col.header}' is not empty.`
          }
        })
      }
    }
  }

  // Invariant 2: Low-Entropy Status/Category Dependency
  for (const condCol of columns) {
    const headerLower = condCol.header.toLowerCase()
    const isExplicitStatusOrType =
      headerLower.endsWith('status') ||
      headerLower.endsWith('state') ||
      headerLower.endsWith('type') ||
      headerLower.endsWith('category')

    if (!isExplicitStatusOrType) continue

    const valueGroups = new Map<string, number[]>()

    for (const row of rows) {
      const val = row.values[condCol.key] ?? null
      if (isMissingValue(val)) continue
      const strVal = stringifyCellValue(val).trim()

      // Absolute safety gate: filter out emails, dates, numbers, long phrases, or personal identifiers
      if (
        !strVal ||
        strVal.includes('@') ||
        strVal.includes(' ') ||
        strVal.length > 20 ||
        /^\d+$/.test(strVal)
      ) {
        continue
      }

      const list = valueGroups.get(strVal) ?? []
      list.push(row.rowNumber)
      valueGroups.set(strVal, list)
    }

    // Low-Entropy Guard: Only true state machines (between 2 and 5 distinct states total)
    if (valueGroups.size < 2 || valueGroups.size > 5) continue

    for (const [condValue, rowNumbers] of valueGroups.entries()) {
      // The condition must represent a significant state in the dataset (at least 5 rows)
      if (rowNumbers.length < 5) continue

      for (const targetCol of columns) {
        if (targetCol.key === condCol.key) continue

        let presentCount = 0
        const missingRows: number[] = []

        for (const rowNum of rowNumbers) {
          const row = rows.find((r) => r.rowNumber === rowNum)
          if (!row) continue
          const targetVal = row.values[targetCol.key] ?? null
          if (!isMissingValue(targetVal)) {
            presentCount++
          } else {
            missingRows.push(rowNum)
          }
        }

        const completenessRate = presentCount / rowNumbers.length

        // Must be >= 85% complete under this status and only missing in a tiny tail
        if (completenessRate >= 0.85 && missingRows.length > 0 && missingRows.length <= 5) {
          for (const rowNum of missingRows) {
            anomalies.push({
              id: `anom_null_${targetCol.key}_${rowNum}`,
              category: 'ATYPICAL_MISSING',
              method: 'null_correlation',
              severity: 'warning',
              confidence: 'HIGH',
              score: Math.round(completenessRate * 100) / 100,
              columnKey: targetCol.key,
              columnHeader: targetCol.header,
              rowNumbers: [rowNum],
              value: null,
              baseline: {
                correlatedColumn: condCol.header,
                conditionValue: condValue,
                completenessRateUnderCondition: Math.round(completenessRate * 100) / 100
              },
              explanation: `Field '${targetCol.header}' is missing, although it is populated in ${(completenessRate * 100).toFixed(1)}% of rows where '${condCol.header}' is '${condValue}'.`,
              actionableSuggestion: {
                type: 'request_data',
                label: `When ${condCol.header} is "${condValue}", ${targetCol.header} is required.`
              }
            })
          }
        }
      }
    }
  }

  return anomalies
}
