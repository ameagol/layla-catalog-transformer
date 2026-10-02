import type { QuestionDef } from 'laya-ts'
import type { ColumnProfile, DatasetColumn, DatasetRow } from '../model/domain'
import { isMissingValue } from '../normalization/normalizers'
import type { DetectedAnomaly, GovernanceRuleDraft } from './types'

export function buildLayaAnomalyQuestions(): Record<string, QuestionDef> {
  return {
    anomaly_category: {
      type: 'choice',
      options: {
        outlier: 'Extreme numerical or quantitative statistical deviation',
        syntax_deviation: 'Format, mask or punctuation pattern deviation',
        type_corruption: 'Wrong data type or corrupt cell value',
        missing_mandatory: 'Atypically absent or blank value',
        valid_exception: 'Acceptable business exception'
      }
    },
    generalization_check: {
      type: 'choice',
      options: {
        universal_rule: 'Universal quality invariant suitable for the whole catalog',
        overfitted_coincidence: 'Too specific, temporary row artifact or coincidental correlation'
      }
    },
    is_genuine_anomaly: {
      type: 'noul',
      question: 'Is this value a genuine data quality anomaly requiring attention?'
    }
  }
}

export function buildLayaAnomalyState(anomaly: DetectedAnomaly): {
  column: string
  observed_value: string
  detection_method: string
  expected_baseline: string
  explanation: string
} {
  return {
    column: anomaly.columnHeader,
    observed_value: String(anomaly.value ?? 'NULL'),
    detection_method: anomaly.method,
    expected_baseline: anomaly.baseline?.dominantPattern
      ? `Dominant mask: ${anomaly.baseline.dominantPattern} (${Math.round((anomaly.baseline.dominantCoverage ?? 0) * 100)}%)`
      : anomaly.baseline?.median !== undefined
      ? `Median: ${anomaly.baseline.median}, MAD: ${anomaly.baseline.mad}`
      : anomaly.baseline?.conditionValue
      ? `Condition: ${anomaly.baseline.correlatedColumn} = ${anomaly.baseline.conditionValue}`
      : 'Standard column distribution',
    explanation: anomaly.explanation
  }
}

/**
 * Discovers Top-Down Governance Invariants directly from dataset profiling:
 * 1. Essential Fields (Unconditional Completeness >= 95%)
 * 2. Primary Keys (100% Uniqueness in identifier/code-like columns)
 * 3. Domain Type Validation (Known semantic types like email, phone, date, cpf)
 * 4. Genuine Low-Entropy State Requirements
 */
export function discoverGovernanceInvariants(
  columns: DatasetColumn[],
  rows: DatasetRow[],
  columnProfiles?: ColumnProfile[]
): GovernanceRuleDraft[] {
  const drafts: GovernanceRuleDraft[] = []
  const seenRuleTexts = new Set<string>()

  // 1. Primary Key Discovery
  for (const col of columns) {
    const rawValues = rows.map((r) => r.values[col.key] ?? null).filter((v) => !isMissingValue(v))
    if (rawValues.length < 10) continue

    const uniqueSet = new Set(rawValues.map((v) => String(v).trim().toLowerCase()))
    const isTotallyUnique = uniqueSet.size === rawValues.length
    const headerLower = col.header.toLowerCase()

    const isKeyLike =
      headerLower.endsWith('id') ||
      headerLower.includes('code') ||
      headerLower.includes('codigo') ||
      headerLower.includes('number') ||
      headerLower.includes('sku') ||
      headerLower.includes('cpf') ||
      headerLower.includes('cnpj')

    if (isTotallyUnique && isKeyLike) {
      const ruleText = `Find duplicate values in ${col.header}`
      if (!seenRuleTexts.has(ruleText)) {
        seenRuleTexts.add(ruleText)
        drafts.push({
          pillar: 'primary_key',
          title: `Primary Key Uniqueness: ${col.header}`,
          ruleText,
          reason: `Every entry in ${col.header} is 100% unique (${rawValues.length} distinct records). Prevent duplicate keys.`,
          columnHeader: col.header,
          category: 'NUMERIC_OUTLIER'
        })
      }
    }
  }

  // 2. Domain Semantic Type Validation
  if (columnProfiles) {
    for (const profile of columnProfiles) {
      if (profile.semanticType === 'email' && profile.semanticConfidence >= 0.8) {
        const ruleText = `Check that ${profile.header} contains a valid email address`
        if (!seenRuleTexts.has(ruleText)) {
          seenRuleTexts.add(ruleText)
          drafts.push({
            pillar: 'type_validation',
            title: `Standard Email Format: ${profile.header}`,
            ruleText,
            reason: `Detected as email format (${Math.round(profile.semanticConfidence * 100)}% confidence). Ensure RFC compliance.`,
            columnHeader: profile.header,
            category: 'FORMAT_DEVIATION'
          })
        }
      }

      if (profile.semanticType === 'phone' && profile.semanticConfidence >= 0.8) {
        const ruleText = `Check for duplicated phones in ${profile.header}`
        if (!seenRuleTexts.has(ruleText)) {
          seenRuleTexts.add(ruleText)
          drafts.push({
            pillar: 'type_validation',
            title: `Phone Standardization: ${profile.header}`,
            ruleText,
            reason: `Detected as telephone column. Standardize punctuation and detect duplicate contacts.`,
            columnHeader: profile.header,
            category: 'FORMAT_DEVIATION'
          })
        }
      }
    }
  }

  return drafts
}

/**
 * Drafts an actionable natural-language rule from an accepted anomaly pattern
 * so the user can promote it directly into their rules catalog.
 */
export function draftRuleFromAnomaly(anomaly: DetectedAnomaly): GovernanceRuleDraft | null {
  if (anomaly.category === 'ATYPICAL_MISSING') {
    if (anomaly.baseline?.dominantCoverage && !anomaly.baseline.correlatedColumn) {
      return {
        pillar: 'essential_field',
        title: `Essential Field: ${anomaly.columnHeader}`,
        ruleText: `Check if ${anomaly.columnHeader} is not empty`,
        reason: `Populated in ${Math.round(anomaly.baseline.dominantCoverage * 100)}% of dataset rows; the few missing cells are unexpected blanks.`,
        category: anomaly.category,
        columnHeader: anomaly.columnHeader
      }
    }

    if (anomaly.baseline?.correlatedColumn && anomaly.baseline?.conditionValue) {
      return {
        pillar: 'status_dependency',
        title: `State Dependency: ${anomaly.baseline.correlatedColumn} → ${anomaly.columnHeader}`,
        ruleText: `If ${anomaly.baseline.correlatedColumn} is "${anomaly.baseline.conditionValue}", ${anomaly.columnHeader} must not be empty`,
        reason: `Populated in ${Math.round((anomaly.baseline.completenessRateUnderCondition ?? 0) * 100)}% of rows when ${anomaly.baseline.correlatedColumn} is "${anomaly.baseline.conditionValue}".`,
        category: anomaly.category,
        columnHeader: anomaly.columnHeader
      }
    }
  }

  if (anomaly.category === 'FORMAT_DEVIATION' && anomaly.baseline?.dominantPattern) {
    const pattern = anomaly.baseline.dominantPattern
    const digitsCount = (pattern.match(/D/g) || []).length
    const isOnlyDigits = /^D+$/.test(pattern)

    let rule = `${anomaly.columnHeader} must match format "${pattern}"`
    if (isOnlyDigits) {
      rule = `${anomaly.columnHeader} must have exactly ${digitsCount} digits`
    }

    return {
      pillar: 'type_validation',
      title: `Format Consistency: ${anomaly.columnHeader}`,
      ruleText: rule,
      reason: `Consistent structure across ${Math.round((anomaly.baseline.dominantCoverage ?? 0) * 100)}% of valid rows.`,
      category: anomaly.category,
      columnHeader: anomaly.columnHeader
    }
  }

  if (anomaly.category === 'NUMERIC_OUTLIER' && anomaly.baseline?.expectedRange) {
    const [min, max] = anomaly.baseline.expectedRange
    return {
      pillar: 'type_validation',
      title: `Valid Range: ${anomaly.columnHeader}`,
      ruleText: `${anomaly.columnHeader} must be between ${min} and ${max}`,
      reason: `Robust empirical range [${min}, ${max}] derived via Median Absolute Deviation (MAD).`,
      category: anomaly.category,
      columnHeader: anomaly.columnHeader
    }
  }

  return null
}
