import type { ColumnProfile, DatasetColumn, DatasetRow } from '../model/domain'
import { isMissingValue } from '../normalization/normalizers'
import { detectMadOutliers } from './statistical'
import { detectFormatAnomalies, detectTypeInconsistencies } from './heuristics'
import { detectAtypicalNulls } from './correlations'
import { discoverGovernanceInvariants, draftRuleFromAnomaly } from './layaDecisions'
import type { AnomalyCategory, AnomalyScanResult, AnomalyScanSummary, AnomalySeverity, DetectedAnomaly, GovernanceRuleDraft } from './types'

export function scanWorksheetAnomalies(
  sheetName: string,
  columns: DatasetColumn[],
  rows: DatasetRow[],
  columnProfiles?: ColumnProfile[]
): AnomalyScanResult {
  const anomalies: DetectedAnomaly[] = []

  for (const col of columns) {
    const rawValues = rows.map((r) => ({ rowNumber: r.rowNumber, value: r.values[col.key] ?? null }))

    // 1. Inconsistências de Tipo de Dado
    const typeAnomalies = detectTypeInconsistencies(col.key, col.header, rawValues)
    anomalies.push(...typeAnomalies)

    // 2. Outliers Numéricos (para dados numéricos)
    const numericEntries = rawValues
      .filter((e) => typeof e.value === 'number' && !Number.isNaN(e.value))
      .map((e) => ({ rowNumber: e.rowNumber, value: e.value as number }))

    if (numericEntries.length >= 5) {
      const madAnomalies = detectMadOutliers(col.key, col.header, numericEntries)
      anomalies.push(...madAnomalies)
    }

    // 3. Desvios de Formato / Sintaxe (para strings não nulas)
    const stringEntries = rawValues
      .filter((e) => typeof e.value === 'string' && !isMissingValue(e.value))
      .map((e) => ({ rowNumber: e.rowNumber, value: e.value as string }))

    if (stringEntries.length >= 10) {
      const formatAnomalies = detectFormatAnomalies(col.key, col.header, stringEntries)
      anomalies.push(...formatAnomalies)
    }
  }

  // 4. Valores Nulos Atípicos (invariantes de completude e dependência de status)
  const nullAnomalies = detectAtypicalNulls(columns, rows)
  anomalies.push(...nullAnomalies)

  // Sumarização
  const byCategory: Record<AnomalyCategory, number> = {
    NUMERIC_OUTLIER: 0,
    FORMAT_DEVIATION: 0,
    DATA_TYPE_INCONSISTENCY: 0,
    ATYPICAL_MISSING: 0,
    SEMANTIC_PATTERN_BREAK: 0
  }

  const bySeverity: Record<AnomalySeverity, number> = {
    critical: 0,
    error: 0,
    warning: 0,
    info: 0
  }

  for (const anom of anomalies) {
    byCategory[anom.category] = (byCategory[anom.category] ?? 0) + 1
    bySeverity[anom.severity] = (bySeverity[anom.severity] ?? 0) + 1
  }

  const summary: AnomalyScanSummary = {
    totalAnomalies: anomalies.length,
    byCategory,
    bySeverity,
    scannedRows: rows.length,
    scannedColumns: columns.length
  }

  // Descoberta de regras orientada a Governança e Invariantes
  const draftRulesMap = new Map<string, GovernanceRuleDraft>()

  // 1. Invariantes de Top-Down (Chaves primárias e tipos canônicos)
  const topDownInvariants = discoverGovernanceInvariants(columns, rows, columnProfiles)
  for (const inv of topDownInvariants) {
    draftRulesMap.set(inv.ruleText, inv)
  }

  // 2. Invariantes derivadas de anomalias genuínas observadas
  for (const anom of anomalies) {
    const draft = draftRuleFromAnomaly(anom)
    if (draft && !draftRulesMap.has(draft.ruleText)) {
      draftRulesMap.set(draft.ruleText, draft)
    }
  }

  return {
    sheetName,
    summary,
    anomalies,
    draftRules: Array.from(draftRulesMap.values())
  }
}
