import type { CellValue } from '../model/domain'
import { isMissingValue } from '../normalization/normalizers'
import type { DetectedAnomaly } from './types'

/**
 * Maps a string value to a structural token mask.
 * Uppercase -> U, Lowercase -> L, Digits -> D, Spaces -> ' '
 * Preserves standard punctuation.
 */
export function stringToStructureMask(val: string): string {
  return val
    .replace(/[A-ZÀ-ÖØ-ß]/gu, 'U')
    .replace(/[a-zà-öø-ÿ]/gu, 'L')
    .replace(/[0-9]/gu, 'D')
    .replace(/[\s\t]/gu, ' ')
}

/**
 * Detects format pattern anomalies via token mask clustering.
 * If >= 85% of records follow a specific format mask, any rare mask (<= 3%) is flagged.
 * Skips unstructured free-text columns (where unique mask ratio is high).
 */
export function detectFormatAnomalies(
  columnKey: string,
  columnHeader: string,
  entries: Array<{ rowNumber: number; value: string }>,
  purityThreshold = 0.85
): DetectedAnomaly[] {
  if (entries.length < 10) return []

  const validEntries = entries.filter((e) => !isMissingValue(e.value) && e.value.trim() !== '')
  if (validEntries.length < 10) return []

  const maskFrequency = new Map<string, number>()
  const itemMasks: Array<{ rowNumber: number; value: string; mask: string }> = []

  for (const { rowNumber, value } of validEntries) {
    const mask = stringToStructureMask(value)
    maskFrequency.set(mask, (maskFrequency.get(mask) ?? 0) + 1)
    itemMasks.push({ rowNumber, value, mask })
  }

  // If there are too many unique masks (e.g. descriptions, addresses, free text), skip format anomaly
  if (maskFrequency.size / validEntries.length > 0.3) return []

  let dominantMask = ''
  let maxCount = 0
  for (const [mask, count] of maskFrequency.entries()) {
    if (count > maxCount) {
      maxCount = count
      dominantMask = mask
    }
  }

  const dominantCoverage = maxCount / validEntries.length
  if (dominantCoverage < purityThreshold) return []

  // Check for rare deviating masks
  const anomalies: DetectedAnomaly[] = []

  for (const item of itemMasks) {
    if (item.mask !== dominantMask) {
      const freq = (maskFrequency.get(item.mask) ?? 0) / validEntries.length
      // Flag only strictly rare patterns (<= 10% of records)
      if (freq <= 0.10) {
        anomalies.push({
          id: `anom_fmt_${columnKey}_${item.rowNumber}`,
          category: 'FORMAT_DEVIATION',
          method: 'mask_clustering',
          severity: 'error',
          confidence: 'HIGH',
          score: Math.round((1 - freq) * 100) / 100,
          columnKey,
          columnHeader,
          rowNumbers: [item.rowNumber],
          value: item.value,
          baseline: {
            dominantPattern: dominantMask,
            dominantCoverage: Math.round(dominantCoverage * 100) / 100
          },
          explanation: `Format structure '${item.mask}' deviates from dominant pattern '${dominantMask}' present in ${(dominantCoverage * 100).toFixed(1)}% of rows.`,
          actionableSuggestion: {
            type: 'auto_format',
            label: `Format as '${dominantMask}'.`
          }
        })
      }
    }
  }

  return anomalies
}

/**
 * Detects cells whose data type clashes with the column's dominant data type.
 */
export function detectTypeInconsistencies(
  columnKey: string,
  columnHeader: string,
  entries: Array<{ rowNumber: number; value: CellValue }>
): DetectedAnomaly[] {
  const nonEmpty = entries.filter((e) => !isMissingValue(e.value))
  if (nonEmpty.length < 5) return []

  const typeCounts: Record<string, number> = { number: 0, text: 0, date: 0, boolean: 0 }

  for (const item of nonEmpty) {
    if (item.value instanceof Date) {
      typeCounts.date = (typeCounts.date ?? 0) + 1
    } else if (typeof item.value === 'number') {
      typeCounts.number = (typeCounts.number ?? 0) + 1
    } else if (typeof item.value === 'boolean') {
      typeCounts.boolean = (typeCounts.boolean ?? 0) + 1
    } else {
      typeCounts.text = (typeCounts.text ?? 0) + 1
    }
  }

  const [dominantType, dominantCount] = Object.entries(typeCounts).sort((a, b) => b[1] - a[1])[0]!
  const purity = dominantCount / nonEmpty.length

  if (purity < 0.85) return []

  const anomalies: DetectedAnomaly[] = []

  for (const item of nonEmpty) {
    const currentType =
      item.value instanceof Date ? 'date' : typeof item.value === 'number' ? 'number' : typeof item.value === 'boolean' ? 'boolean' : 'text'

    if (currentType !== dominantType) {
      anomalies.push({
        id: `anom_type_${columnKey}_${item.rowNumber}`,
        category: 'DATA_TYPE_INCONSISTENCY',
        method: 'type_voting',
        severity: 'error',
        confidence: 'HIGH',
        score: Math.round(purity * 100) / 100,
        columnKey,
        columnHeader,
        rowNumbers: [item.rowNumber],
        value: item.value,
        baseline: {
          dominantValue: dominantType,
          dominantCoverage: Math.round(purity * 100) / 100
        },
        explanation: `Tipo '${currentType}' inconsistente com o tipo '${dominantType}' predominante em ${(purity * 100).toFixed(1)}% dos registros válidos.`,
        actionableSuggestion: {
          type: 'flag_or_scale',
          label: `Converter ou corrigir o valor para o tipo esperado (${dominantType}).`
        }
      })
    }
  }

  return anomalies
}
