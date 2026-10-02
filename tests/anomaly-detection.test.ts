import { describe, expect, it } from 'vitest'
import { detectMadOutliers } from '../src/core/anomaly/statistical'
import { detectFormatAnomalies, detectTypeInconsistencies } from '../src/core/anomaly/heuristics'
import { detectAtypicalNulls } from '../src/core/anomaly/correlations'
import { scanWorksheetAnomalies } from '../src/core/anomaly/scanner'
import { discoverGovernanceInvariants, draftRuleFromAnomaly } from '../src/core/anomaly/layaDecisions'
import type { ColumnProfile, DatasetColumn, DatasetRow } from '../src/core/model/domain'

describe('Autonomous Anomaly Detection & Governance Engine', () => {
  it('detects numeric outliers via robust MAD statistics', () => {
    // Normal distribution around 100 with one extreme outlier at 50,000
    const entries = [
      { rowNumber: 1, value: 100 },
      { rowNumber: 2, value: 102 },
      { rowNumber: 3, value: 98 },
      { rowNumber: 4, value: 101 },
      { rowNumber: 5, value: 99 },
      { rowNumber: 6, value: 105 },
      { rowNumber: 7, value: 50000 }
    ]

    const anomalies = detectMadOutliers('price', 'Price', entries, 3.5)
    expect(anomalies).toHaveLength(1)
    expect(anomalies[0]?.rowNumbers[0]).toBe(7)
    expect(anomalies[0]?.category).toBe('NUMERIC_OUTLIER')
    expect(anomalies[0]?.severity).toBe('critical')
  })

  it('detects format deviations via token mask clustering', () => {
    // 10 items with mask DDDD-DDDD, 1 item deviating
    const entries = [
      { rowNumber: 1, value: '1234-5678' },
      { rowNumber: 2, value: '9876-5432' },
      { rowNumber: 3, value: '1111-2222' },
      { rowNumber: 4, value: '3333-4444' },
      { rowNumber: 5, value: '5555-6666' },
      { rowNumber: 6, value: '7777-8888' },
      { rowNumber: 7, value: '9999-0000' },
      { rowNumber: 8, value: '1212-3434' },
      { rowNumber: 9, value: '5656-7878' },
      { rowNumber: 10, value: '9090-1212' },
      { rowNumber: 11, value: 'INVALID_STRING' } // UUUUUUU_UUUUUU
    ]

    const anomalies = detectFormatAnomalies('code', 'ProductCode', entries, 0.85)
    expect(anomalies).toHaveLength(1)
    expect(anomalies[0]?.rowNumbers).toEqual([11])
    expect(anomalies[0]?.category).toBe('FORMAT_DEVIATION')
  })

  it('detects data type inconsistencies in homogeneous columns', () => {
    const entries = [
      { rowNumber: 1, value: 10 },
      { rowNumber: 2, value: 20 },
      { rowNumber: 3, value: 30 },
      { rowNumber: 4, value: 40 },
      { rowNumber: 5, value: 50 },
      { rowNumber: 6, value: 60 },
      { rowNumber: 7, value: 'N/A' } // string in predominantly numeric column
    ]

    const anomalies = detectTypeInconsistencies('qty', 'Quantity', entries)
    expect(anomalies).toHaveLength(1)
    expect(anomalies[0]?.rowNumbers).toEqual([7])
    expect(anomalies[0]?.category).toBe('DATA_TYPE_INCONSISTENCY')
  })

  it('detects atypical nulls when correlated low-entropy status condition is met', () => {
    const columns: DatasetColumn[] = [
      { key: 'status', header: 'OrderStatus', index: 0 },
      { key: 'tracking', header: 'TrackingCode', index: 1 }
    ]

    const rows: DatasetRow[] = []
    // 6 rows with OrderStatus: 'Shipped' (Tracking present), 4 rows with 'Pending' (Tracking null)
    for (let i = 1; i <= 6; i++) {
      rows.push({
        rowNumber: i,
        values: { status: 'Shipped', tracking: `TRACK_${i}` }
      })
    }
    // 1 row with OrderStatus: 'Shipped' but Tracking is unexpectedly NULL
    rows.push({
      rowNumber: 7,
      values: { status: 'Shipped', tracking: null }
    })
    // 4 rows with OrderStatus: 'Pending'
    for (let i = 8; i <= 11; i++) {
      rows.push({
        rowNumber: i,
        values: { status: 'Pending', tracking: null }
      })
    }

    const anomalies = detectAtypicalNulls(columns, rows)
    expect(anomalies.length).toBeGreaterThanOrEqual(1)
    expect(anomalies.some((a) => a.category === 'ATYPICAL_MISSING')).toBe(true)
  })

  it('ignores high-cardinality values like emails or personal names for conditional rules', () => {
    const columns: DatasetColumn[] = [
      { key: 'owner', header: 'OwnerEmail', index: 0 },
      { key: 'phone', header: 'Phone', index: 1 }
    ]

    const rows: DatasetRow[] = []
    for (let i = 1; i <= 10; i++) {
      rows.push({
        rowNumber: i,
        values: {
          owner: i === 10 ? 'patrick@test.com' : `user_${i}@test.com`,
          phone: i === 10 ? null : '123456789'
        }
      })
    }

    const anomalies = detectAtypicalNulls(columns, rows)
    // Should NOT create conditional rules like "When OwnerEmail is patrick@test.com"
    const conditionalOnPatrick = anomalies.some(
      (a) => a.baseline?.conditionValue === 'patrick@test.com'
    )
    expect(conditionalOnPatrick).toBe(false)
  })

  it('discovers top-down governance invariants for primary keys and domain types', () => {
    const columns: DatasetColumn[] = [
      { key: 'customer_id', header: 'CustomerID', index: 0 }
    ]
    const rows: DatasetRow[] = []
    for (let i = 1; i <= 15; i++) {
      rows.push({
        rowNumber: i,
        values: { customer_id: `CUST_${i}` }
      })
    }

    const profiles: Partial<ColumnProfile>[] = [
      {
        key: 'customer_id',
        header: 'CustomerID',
        index: 0,
        dataType: 'text',
        semanticType: 'identifier',
        semanticConfidence: 0.95
      } as ColumnProfile
    ]

    const invariants = discoverGovernanceInvariants(columns, rows, profiles as ColumnProfile[])
    expect(invariants).toHaveLength(1)
    expect(invariants[0]?.pillar).toBe('primary_key')
    expect(invariants[0]?.ruleText).toBe('Find duplicate values in CustomerID')
  })

  it('drafts clean governance rule from anomaly', () => {
    const formatAnomaly = {
      id: 'anom_1',
      category: 'FORMAT_DEVIATION' as const,
      method: 'mask_clustering' as const,
      severity: 'error' as const,
      confidence: 'HIGH' as const,
      score: 0.95,
      columnKey: 'cpf',
      columnHeader: 'CPF',
      rowNumbers: [5],
      value: '12345',
      baseline: {
        dominantPattern: 'DDDDDDDDDDD',
        dominantCoverage: 0.98
      },
      explanation: 'Format deviation'
    }

    const draft = draftRuleFromAnomaly(formatAnomaly)
    expect(draft).not.toBeNull()
    expect(draft?.ruleText).toBe('CPF must have exactly 11 digits')
    expect(draft?.pillar).toBe('type_validation')
  })

  it('runs complete worksheet scan and produces categorized governance drafts', () => {
    const columns: DatasetColumn[] = [
      { key: 'col1', header: 'Amount', index: 0 }
    ]
    const rows: DatasetRow[] = [
      { rowNumber: 1, values: { col1: 10 } },
      { rowNumber: 2, values: { col1: 12 } },
      { rowNumber: 3, values: { col1: 11 } },
      { rowNumber: 4, values: { col1: 10 } },
      { rowNumber: 5, values: { col1: 13 } },
      { rowNumber: 6, values: { col1: 9999 } }
    ]

    const result = scanWorksheetAnomalies('Sheet1', columns, rows)
    expect(result.summary.totalAnomalies).toBeGreaterThanOrEqual(1)
    expect(result.summary.byCategory.NUMERIC_OUTLIER).toBe(1)
  })
})
