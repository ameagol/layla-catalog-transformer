import { describe, expect, it } from 'vitest'

import { localGuidance, routeForFinding, selectCurrentFinding } from '../src/core/copilot/guidance'
import { copilotGuideInputSchema } from '../src/core/ipc/schemas'
import type { AnalysisResult, Finding, FindingType } from '../src/core/model/domain'

function finding(type: FindingType): Finding {
  return {
    id: 'finding-abc123', type, severity: 'warning', confidence: 'MEDIUM', ruleId: 'rule-1',
    ruleText: 'Verificar cadastro', sheet: 'Clientes', rowNumbers: [2], fields: ['email'],
    evidence: [], explanation: 'Revisar', suggestedAction: 'Conferir', createdAt: '2026-01-01'
  }
}

describe('copilot local fallback', () => {
  it.each([
    ['DUPLICATE', 'review_duplicate'], ['POSSIBLE_DUPLICATE', 'review_duplicate'],
    ['MISSING', 'complete_attribute'], ['INVALID', 'verify_source'],
    ['INCONSISTENT', 'verify_source'], ['RULE_VIOLATION', 'human_review']
  ] as const)('routes %s to %s without claiming model inference', (type, route) => {
    expect(routeForFinding(finding(type))).toBe(route)
    expect(localGuidance(finding(type))).toMatchObject({ status: 'unavailable', route })
  })

  it('uses conditional impact and requires source confirmation', () => {
    expect(localGuidance(finding('MISSING')).impact).toContain('Potential impact')
    expect(localGuidance(finding('DUPLICATE')).nextStep).toContain('authorized source')
    expect(localGuidance(finding('RULE_VIOLATION')).nextStep).toContain('human review')
  })

  it('rejects stale analyses, unknown findings and malformed IPC identifiers', () => {
    const current = { id: '00000000-0000-4000-8000-000000000001', findings: [finding('MISSING')] } as AnalysisResult
    expect(selectCurrentFinding(current, current.id, 'finding-abc123')).toBe(current.findings[0])
    expect(() => selectCurrentFinding(current, '00000000-0000-4000-8000-000000000002', 'finding-abc123')).toThrow()
    expect(() => selectCurrentFinding(current, current.id, 'finding-other')).toThrow()
    expect(copilotGuideInputSchema.safeParse({ analysisId: current.id, findingId: '../file' }).success).toBe(false)
  })
})
