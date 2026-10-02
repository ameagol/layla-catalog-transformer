import type { CellValue } from '../model/domain'
import type { DetectedAnomaly } from './types'

export interface NumericOutlierResult {
  rowNumber: number
  value: number
  score: number
  median: number
  mad: number
  expectedRange: [number, number]
  explanation: string
}

/**
 * Calculates median and Median Absolute Deviation (MAD).
 * Modified Z-score: Mi = (0.6745 * |x - median|) / MAD
 * Robust against masking and multiple extreme values.
 */
export function detectMadOutliers(
  columnKey: string,
  columnHeader: string,
  entries: Array<{ rowNumber: number; value: number }>,
  threshold = 3.5
): DetectedAnomaly[] {
  if (entries.length < 5) return []

  const sortedNumbers = entries.map((e) => e.value).sort((a, b) => a - b)
  const mid = Math.floor(sortedNumbers.length / 2)
  const median = sortedNumbers.length % 2 === 0
    ? (sortedNumbers[mid - 1]! + sortedNumbers[mid]!) / 2
    : sortedNumbers[mid]!

  const absDiffs = sortedNumbers.map((v) => Math.abs(v - median)).sort((a, b) => a - b)
  const mad = absDiffs.length % 2 === 0
    ? (absDiffs[mid - 1]! + absDiffs[mid]!) / 2
    : absDiffs[mid]!

  if (mad === 0) return []

  // Estimate expected normal range based on MAD
  const lowerBound = Math.round((median - (threshold * mad) / 0.6745) * 100) / 100
  const upperBound = Math.round((median + (threshold * mad) / 0.6745) * 100) / 100

  const anomalies: DetectedAnomaly[] = []

  for (const entry of entries) {
    const diff = Math.abs(entry.value - median)
    const modifiedZ = (0.6745 * diff) / mad

    if (modifiedZ >= threshold) {
      const normalizedScore = Math.min(1.0, 0.7 + (modifiedZ - threshold) * 0.05)
      const severity = modifiedZ > 8 ? 'critical' : modifiedZ > 5 ? 'error' : 'warning'

      anomalies.push({
        id: `anom_mad_${columnKey}_${entry.rowNumber}`,
        category: 'NUMERIC_OUTLIER',
        method: 'statistical_mad',
        severity,
        confidence: modifiedZ > 5 ? 'HIGH' : 'MEDIUM',
        score: Math.round(normalizedScore * 100) / 100,
        columnKey,
        columnHeader,
        rowNumbers: [entry.rowNumber],
        value: entry.value,
        baseline: {
          median,
          mad,
          expectedRange: [lowerBound, upperBound]
        },
        explanation: `Valor ${entry.value} possui desvio estatístico robusto (Modified Z = ${modifiedZ.toFixed(2)}x) fora da mediana ${median.toFixed(2)} (faixa típica: ${lowerBound} a ${upperBound}).`,
        actionableSuggestion: {
          type: 'flag_or_scale',
          label: 'Verificar possível erro de digitação, fator de escala ou valor discrepante.'
        }
      })
    }
  }

  return anomalies
}
