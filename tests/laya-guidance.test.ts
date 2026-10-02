import { describe, expect, it, vi } from 'vitest'

import { comparisonSignals, layaGuidance } from '../src/core/copilot/guidance'
import type { AnalysisResult, Finding } from '../src/core/model/domain'
import { CopilotService } from '../src/main/services/copilotService'
import type { AnalysisService } from '../src/main/services/analysisService'
import type { SettingsStore } from '../src/main/services/settingsStore'
import type { WorkbookService } from '../src/main/services/workbookService'
import { compileRules } from '../src/core/rules/compiler'
import { parseSourceRules } from '../src/core/rules/source'
import { createCustomerProfile } from './fixtures'

const finding: Finding = {
  id: 'finding-abc123', type: 'POSSIBLE_DUPLICATE', severity: 'warning', confidence: 'LOW',
  ruleId: 'rule-1', ruleText: 'Compare customers', sheet: 'Customers', rowNumbers: [2, 3],
  fields: ['name'], evidence: [], explanation: 'Possible duplicate', suggestedAction: 'Review', createdAt: '2026-01-01'
}
const analysisId = '00000000-0000-4000-8000-000000000001'

describe('Laya conservative decision boundary', () => {
  it('accepts a valid choice but never changes the finding itself', () => {
    expect(layaGuidance(finding, 'review_duplicate', 0.9)).toMatchObject({
      status: 'laya', route: 'review_duplicate', confidence: 0.9
    })
    expect(finding.confidence).toBe('LOW')
  })

  it.each([['unsupported', 0.99], ['review_duplicate', 0.79], ['review_duplicate', NaN]])(
    'abstains for invalid or weak output %s', (choice, confidence) => {
      expect(layaGuidance(finding, choice, confidence)).toMatchObject({ status: 'needs_review', route: 'human_review' })
    }
  )

  it('refuses a model suggestion that contradicts the detected finding type', () => {
    expect(layaGuidance(finding, 'complete_attribute', 0.99)).toMatchObject({ status: 'needs_review', route: 'human_review' })
  })

  it('permits relationship checking only for possible duplicate review', () => {
    expect(layaGuidance(finding, 'check_relationship', 0.9, ['identifier: not equal'])).toMatchObject({ status: 'laya', route: 'check_relationship' })
    expect(layaGuidance(finding, 'check_relationship', 0.9)).toMatchObject({ status: 'needs_review' })
    expect(layaGuidance({ ...finding, type: 'MISSING' }, 'check_relationship', 0.9)).toMatchObject({ status: 'needs_review', route: 'human_review' })
  })

  it('builds bounded, value-free observations from contextual columns', () => {
    const signals = comparisonSignals(finding, {
      columns: [{ key: 'phone', header: 'Phone' }, { key: 'id', header: 'ID' }],
      rows: [
        { rowNumber: 2, values: { phone: '111', id: 'ACME-secret-A' } },
        { rowNumber: 3, values: { phone: '222', id: 'ACME-secret-B' } }
      ]
    })
    expect(signals).toHaveLength(2)
    expect(signals.join(' ')).toContain('not equal')
    expect(signals.join(' ')).not.toContain('ACME-secret')
  })

  it('rejects stale/unknown IDs before attempting to load a model', async () => {
    const analysis = { getActiveResult: (id: string) => {
      if (id !== analysisId) throw new Error('Stale analysis')
      return { id, findings: [finding] } as AnalysisResult
    } } as AnalysisService
    const service = new CopilotService(analysis, { get: async () => ({ copilot: { endpoint: '', model: '' } }) } as SettingsStore, 'nonexistent-model-root')
    await expect(service.guide('00000000-0000-4000-8000-000000000002', finding.id)).rejects.toThrow('Stale')
    await expect(service.guide(analysisId, 'finding-other')).rejects.toThrow('Finding')
    await expect(service.guide(analysisId, finding.id)).resolves.toMatchObject({ status: 'unavailable' })
  })

  it('uses the local model for non-duplicate review without modifying the detected violation', async () => {
    const invalid = { ...finding, type: 'INVALID' as const }
    const analysis = { getActiveResult: () => ({ id: analysisId, findings: [invalid] }) as AnalysisResult } as unknown as AnalysisService
    const predict = vi.fn().mockResolvedValue({
      answers: { route: { type: 'choice', choice: 'verify_source', answer_confidence: 0.91 } }, usage: { truncated: false }
    })
    const service = new CopilotService(analysis, {} as SettingsStore, '', undefined, { ready: async () => undefined, predict })
    const suggestion = await service.guide(analysisId, invalid.id)
    expect(suggestion).toMatchObject({ status: 'laya', route: 'verify_source' })
    expect(invalid.type).toBe('INVALID')
    expect(predict).toHaveBeenCalledOnce()
  })

  it('shows profile-based coverage candidates but abstains on an invented model choice', async () => {
    const rows = [
      { rowNumber: 2, values: { name: 'A', phone: '111', email: 'a@b.com', cpf: '1' } },
      { rowNumber: 3, values: { name: 'B', phone: '', email: '', cpf: '2' } }
    ]
    const profile = createCustomerProfile(rows)
    const compilation = compileRules(parseSourceRules('Flag customers with a missing email.'), profile, {})
    const analysis = { getActiveResult: () => ({ id: analysisId, sessionId: analysisId, sheetName: 'Customers', compilation, findings: [] }) as unknown as AnalysisResult } as unknown as AnalysisService
    const workbooks = { getWorksheetData: async () => ({ profile, rows }) } as unknown as WorkbookService
    const service = new CopilotService(analysis, {} as SettingsStore, '', workbooks, { ready: async () => undefined, predict: vi.fn().mockResolvedValue({
      answers: { focus: { type: 'choice', choice: 'invented', answer_confidence: 0.99 } }, usage: { truncated: false }
    }) })
    const coverage = await service.coverage(analysisId)
    expect(coverage.candidates.length).toBeGreaterThan(0)
    expect(coverage).toMatchObject({ source: 'needs_review', suggestedId: null })
  })
})
