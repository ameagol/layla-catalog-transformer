import { describe, expect, it } from 'vitest'

import { buildFindingSourceRows } from '../src/core/findings/sourceRows'
import { consolidateFindings } from '../src/core/findings/consolidate'
import { NAV_ITEMS } from '../src/renderer/src/app/constants'
import { FINDING_COLORS } from '../src/renderer/src/styles/theme'
import { buildSourceRowView, filterFindings, findingTypeLabel, formatFindingRows, getAnalysisReadiness } from '../src/renderer/src/features/findings/helper'
import type { FindingFilters } from '../src/renderer/src/features/findings/models'
import { FINDING_IMPACT_LABELS } from '../src/renderer/src/features/findings/constants'
import { createFinding, findingColumns, findingRows } from './finding-fixtures'

const noFilters: FindingFilters = { search: '', type: 'all', severity: 'all', confidence: 'all' }

describe('minimal findings workflow', () => {
  it('places Load Dataset after Projects and removes the separate Copilot and Analysis tabs', () => {
    expect(NAV_ITEMS.map((item) => item.label)).toEqual(['Projects', 'Load Dataset', 'Rules', 'Findings'])
    expect(NAV_ITEMS.map((item) => item.path)).not.toContain('/copilot')
    expect(NAV_ITEMS.map((item) => item.path)).not.toContain('/analysis')
    expect(NAV_ITEMS.map((item) => item.path)).not.toContain('/export')
    expect(NAV_ITEMS.map((item) => item.path)).not.toContain('/settings')
  })

  it('uses the requested concise finding names and row summaries', () => {
    expect(findingTypeLabel('DUPLICATE')).toBe('Duplicated')
    expect(findingTypeLabel('MISSING')).toBe('Missing')
    expect(formatFindingRows([204, 2])).toBe('[ 2, 204 ]')
    expect(formatFindingRows([2])).toBe('[ 2 ]')
    expect(formatFindingRows([2, 204, 205])).toBe('[ Multi ]')
    expect(formatFindingRows([2, 2])).toBe('[ 2 ]')
  })

  it('keeps severity, confidence and type filters working behind the compact controls', () => {
    const findings = [createFinding(), createFinding({ id: 'finding-other', type: 'MISSING', severity: 'error', confidence: 'LOW' })]
    expect(filterFindings(findings, { ...noFilters, type: 'MISSING' }).map((finding) => finding.id)).toEqual(['finding-other'])
    expect(filterFindings(findings, { ...noFilters, severity: 'error', confidence: 'LOW' }).map((finding) => finding.id)).toEqual(['finding-other'])
    expect(filterFindings(findings, { ...noFilters, severity: 'error', confidence: 'HIGH' })).toEqual([])
  })

  it('uses compact impact labels with accessible full descriptions and the highest group impact', () => {
    const groups = consolidateFindings([
      createFinding({ id: 'duplicate', impactLevel: 'small' }),
      createFinding({ id: 'missing', type: 'MISSING', rowNumbers: [2], impactLevel: 'large' }),
      createFinding({ id: 'default', rowNumbers: [9] }),
      createFinding({ id: 'low', rowNumbers: [10], impactLevel: 'small' })
    ])
    expect(groups.map((group) => FINDING_IMPACT_LABELS[group.impactLevel])).toEqual([
      { badge: 'high', label: 'High impact' },
      { badge: 'med', label: 'Medium impact' },
      { badge: 'low', label: 'Low impact' }
    ])
  })

  it('searches labels, source values and row numbers without changing the original findings', () => {
    const findings = [createFinding()]
    for (const search of ['duplicated', '204', ' PHONE ', '(11) 2020-9090']) {
      expect(filterFindings(findings, { ...noFilters, search })).toHaveLength(1)
    }
    expect(filterFindings(findings, { ...noFilters, search: 'no match' })).toEqual([])
    expect(findings).toHaveLength(1)
  })

  it('shows zero context values and pairs original phone formatting with normalization', () => {
    const finding = createFinding()
    const source = buildFindingSourceRows(finding, findingColumns, findingRows)
    const rows = buildSourceRowView(source, finding)
    expect(rows[0]?.cells[0]).toEqual({ columnKey: 'id', original: '0', normalized: null, affected: false })
    expect(rows[0]?.cells[2]).toEqual({ columnKey: 'phone', original: '11 - 20209090', normalized: '1120209090', affected: true })
    expect(rows[1]?.cells[2]?.original).toBe('(11) 2020-9090')
  })

  it('omits unchanged normalized values and preserves empty values', () => {
    const finding = createFinding({ evidence: [], fields: ['Email'], rowNumbers: [204] })
    const rows = buildSourceRowView(buildFindingSourceRows(finding, findingColumns, findingRows), finding)
    expect(rows[0]?.cells[2]).toEqual({ columnKey: 'email', original: '', normalized: null, affected: true })
    const unchanged = createFinding({ evidence: createFinding().evidence.map((evidence) => ({ ...evidence, normalizedValue: String(evidence.originalValue) })) })
    expect(buildSourceRowView(buildFindingSourceRows(unchanged, findingColumns, findingRows), unchanged)[0]?.cells[2]?.normalized).toBeNull()
  })

  it('offers actionable readiness links before a project, dataset and rules are available', () => {
    const checks = getAnalysisReadiness(null, null, null)
    expect(checks.every((check) => !check.ready)).toBe(true)
    expect(checks.map((check) => check.path)).toEqual(['/projects', '/dataset', '/rules', '/rules'])
  })

  it('uses stable, distinct finding colors with orange duplicates and red missing values', () => {
    expect(FINDING_COLORS.DUPLICATE.ink).toBe('var(--badge-orange)')
    expect(FINDING_COLORS.MISSING.ink).toBe('var(--danger)')
    expect(new Set(Object.values(FINDING_COLORS).map((colors) => colors.ink)).size).toBe(8)
  })

  it('puts High-impact findings first while preserving the order within each impact level', () => {
    const findings = [
      createFinding({ id: 'low', impactLevel: 'small' }),
      createFinding({ id: 'default' }),
      createFinding({ id: 'high', impactLevel: 'large' }),
      createFinding({ id: 'medium', impactLevel: 'medium' }),
      createFinding({ id: 'high-second', impactLevel: 'large' })
    ]
    expect(filterFindings(findings, noFilters).map((finding) => finding.id)).toEqual(['high', 'high-second', 'default', 'medium', 'low'])
    expect(findings[0]?.id).toBe('low')
  })
})
