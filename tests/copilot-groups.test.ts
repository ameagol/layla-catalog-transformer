import { describe, expect, it } from 'vitest'

import type { Finding } from '../src/core/model/domain'
import { groupFindings } from '../src/renderer/src/features/copilot/groupFindings'

function finding(id: string, type: Finding['type'], ruleId: string, rowNumbers: number[], severity: Finding['severity'] = 'warning'): Finding {
  return {
    id, type, ruleId, rowNumbers, severity, confidence: 'HIGH',
    ruleText: `Rule ${ruleId}`, sheet: 'Customers', fields: [], evidence: [],
    explanation: 'Review', suggestedAction: 'Check source', createdAt: '2026-01-01'
  }
}

describe('copilot investigation groups', () => {
  it('groups the same violation while keeping different rules separate', () => {
    const groups = groupFindings([
      finding('a', 'MISSING', 'email', [2, 3]),
      finding('b', 'MISSING', 'email', [3, 4]),
      finding('c', 'MISSING', 'phone', [5]),
      finding('d', 'DUPLICATE', 'email', [6, 7], 'critical')
    ])
    expect(groups).toHaveLength(3)
    expect(groups[0]?.type).toBe('DUPLICATE')
    expect(groups.find((group) => group.key === 'MISSING:email')).toMatchObject({ affectedRows: 3 })
    expect(groups.find((group) => group.key === 'MISSING:email')?.findings).toHaveLength(2)
  })
})
