import { describe, expect, it } from 'vitest'

import type { Finding } from '../src/core/model/domain'
import { impactForFinding, ownerForFinding, priorityForFinding } from '../src/renderer/src/features/copilot/triage'

function finding(partial: Partial<Finding>): Finding {
  return {
    id: 'finding-1', type: 'MISSING', severity: 'warning', confidence: 'HIGH',
    ruleId: 'rule-1', ruleText: 'Email is required', sheet: 'Customers',
    rowNumbers: [2], fields: ['email'], evidence: [], explanation: 'Email missing',
    suggestedAction: 'Check source', createdAt: '2026-01-01T00:00:00Z', ...partial
  }
}

describe('copilot triage', () => {
  it('suggests roles, not a named person', () => {
    expect(ownerForFinding(finding({ type: 'DUPLICATE' })).toLowerCase()).toContain('data steward')
    expect(ownerForFinding(finding({ type: 'MISSING' })).toLowerCase()).toContain('record owner')
  })

  it('uses the user-selected impact before severity when one is present', () => {
    expect(priorityForFinding(finding({ severity: 'info', impactLevel: 'large' })).rank)
      .toBeGreaterThan(priorityForFinding(finding({ severity: 'critical', impactLevel: 'small' })).rank)
  })

  it('orders by severity and confidence without claiming financial impact', () => {
    const critical = priorityForFinding(finding({ severity: 'critical', confidence: 'LOW' }))
    const warning = priorityForFinding(finding({ severity: 'warning', confidence: 'HIGH' }))
    expect(critical.rank).toBeGreaterThan(warning.rank)
    expect(critical.label).toBe('high')
    expect(warning.label).toBe('medium')
  })

  it('describes business risk as a possibility', () => {
    expect(impactForFinding(finding({ type: 'DUPLICATE' }))).toContain('may')
    expect(impactForFinding(finding({ type: 'MISSING' }))).toContain('may')
  })
})
