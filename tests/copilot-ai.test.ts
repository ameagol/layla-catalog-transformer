import { afterEach, describe, expect, it, vi } from 'vitest'

import { extractCopilotAnswer, findingContext, responseShape } from '../src/core/copilot/aiContract'
import { copilotAskInputSchema, copilotRowsInputSchema } from '../src/core/ipc/schemas'
import { DEFAULT_SETTINGS } from '../src/core/model/defaults'
import type { AnalysisResult, Finding } from '../src/core/model/domain'
import { CopilotService } from '../src/main/services/copilotService'
import type { AnalysisService } from '../src/main/services/analysisService'
import type { SettingsStore } from '../src/main/services/settingsStore'
import type { WorkbookService } from '../src/main/services/workbookService'

const finding: Finding = {
  id: 'finding-abc123', type: 'MISSING', severity: 'warning', confidence: 'HIGH',
  ruleId: 'rule-1', ruleText: 'Email is required', sheet: 'Customers',
  rowNumbers: [7], fields: ['email'], explanation: 'Email missing',
  suggestedAction: 'Check source', createdAt: '2026-01-01',
  evidence: [{ rowNumber: 7, columnKey: 'email', columnHeader: 'Email', originalValue: 'private@example.com', normalizedValue: 'private@example.com', comparator: 'required' }]
}
const analysisId = '00000000-0000-4000-8000-000000000001'

function service(sendFindingEvidence = false, endpoint = 'https://example.test/v1/chat/completions') {
  const analysis = { getActiveResult: () => ({ id: analysisId, findings: [finding] }) as AnalysisResult } as unknown as AnalysisService
  const settings = {
    get: async () => ({ ...DEFAULT_SETTINGS, copilot: { endpoint, model: 'test-model', apiKeyConfigured: true, sendFindingEvidence } }),
    getCopilotSecret: async () => 'test-secret'
  } as SettingsStore
  return new CopilotService(analysis, settings, 'unused-test-user-data')
}

afterEach(() => vi.unstubAllGlobals())

describe('copilot AI request', () => {
  it('sends only the selected finding and validates a real AI response', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ choices: [{ message: { content: 'Confirme a origem do e-mail.' } }] }) })
    vi.stubGlobal('fetch', fetchMock)
    const answer = await service().ask(analysisId, finding.id, 'Qual o impacto?')
    expect(answer).toEqual({ source: 'ai', answer: 'Confirme a origem do e-mail.', model: 'test-model' })
    const [url, options] = fetchMock.mock.calls[0]!
    const body = JSON.parse(options.body)
    expect(url.toString()).toBe('https://example.test/v1/chat/completions')
    expect(options.headers.authorization).toBe('Bearer test-secret')
    expect(body.messages[1].content).not.toContain('private@example.com')
    expect(body.messages[1].content).toContain('Qual o impacto?')
    expect(body.messages[1].content).toContain('potentialImpact')
    expect(body.messages[1].content).toContain('suggestedOwnerRole')
    expect(body).not.toHaveProperty('temperature')
  })

  it('includes limited evidence only when explicitly enabled', () => {
    expect(findingContext(finding, false).evidence).toBeUndefined()
    expect(findingContext(finding, true).evidence?.[0]?.originalValue).toBe('private@example.com')
  })

  it('uses the chat route when Settings contains only an API base URL', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ choices: [{ message: { content: 'Review the source.' } }] }) })
    vi.stubGlobal('fetch', fetchMock)
    await service(false, 'https://example.test/v1').ask(analysisId, finding.id, 'Why?')
    expect(fetchMock.mock.calls[0]?.[0].toString()).toBe('https://example.test/v1/chat/completions')
    await service(false, 'https://example.test/custom/chat').ask(analysisId, finding.id, 'Why?')
    expect(fetchMock.mock.calls[1]?.[0].toString()).toBe('https://example.test/custom/chat')
  })

  it('rejects unsafe endpoints, stale findings and malformed answers', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ choices: [] }) })
    vi.stubGlobal('fetch', fetchMock)
    await expect(service().ask(analysisId, finding.id, 'Why?')).rejects.toThrow('fields: choices')
    await expect(service(false, 'http://external.example/chat').ask(analysisId, finding.id, 'Why?')).rejects.toThrow('HTTPS')
    await expect(service().ask(analysisId, 'finding-other', 'Why?')).rejects.toThrow()
    expect(copilotAskInputSchema.safeParse({ analysisId, findingId: finding.id, question: ' ' }).success).toBe(false)
  })

  it('reports a rejected model request without exposing provider response details', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 400, json: async () => ({ detail: 'private diagnostic' }) }))
    await expect(service().ask(analysisId, finding.id, 'What happened?')).rejects.toThrow('HTTP 400')
    const error = await service().ask(analysisId, finding.id, 'What happened?').catch((reason: unknown) => reason)
    expect((error as Error).message).toContain('Chat Completions')
    expect((error as Error).message).not.toContain('private diagnostic')
  })

  it('returns only selected columns on affected rows from the active workbook', async () => {
    const dataset = {
      profile: { columns: [{ key: 'email', header: 'Email' }, { key: 'secret', header: 'Internal notes' }] },
      rows: [
        { rowNumber: 7, values: { email: 'private@example.com', secret: 'private note' } },
        { rowNumber: 8, values: { email: 'other@example.com', secret: 'unrelated note' } }
      ]
    }
    const workbooks = { getWorksheetData: vi.fn().mockResolvedValue(dataset) } as unknown as WorkbookService
    const analysis = { getActiveResult: (id: string) => {
      if (id !== analysisId) throw new Error('Stale analysis')
      return { id, sessionId: analysisId, sheetName: 'Customers', findings: [finding] } as AnalysisResult
    } } as AnalysisService
    const copilot = new CopilotService(analysis, {} as SettingsStore, '', workbooks)
    const context = await copilot.rows(analysisId, finding.id, ['email'])
    expect(context).toEqual({ columns: [{ key: 'email', header: 'Email' }], rows: [{ rowNumber: 7, values: { email: 'private@example.com' } }] })
    expect(workbooks.getWorksheetData).toHaveBeenCalledWith(analysisId, 'Customers')
    await expect(copilot.rows(analysisId, finding.id, ['invented'])).rejects.toThrow('Selected column')
    await expect(copilot.rows(analysisId, 'finding-other', ['email'])).rejects.toThrow()
    await expect(copilot.rows('00000000-0000-4000-8000-000000000002', finding.id, ['email'])).rejects.toThrow('Stale')
    expect(copilotRowsInputSchema.safeParse({ analysisId, findingId: finding.id, columnKeys: Array(9).fill('email') }).success).toBe(false)
    expect(copilotRowsInputSchema.safeParse({ analysisId, findingId: finding.id, columnKeys: ['email', 'email'] }).success).toBe(false)
  })

  it('reports typed gateway output as an endpoint problem without exposing its contents', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ Output: { __type: 'ProviderException', message: 'private provider details' }, Version: '1' })
    }))
    const error = await service().ask(analysisId, finding.id, 'Why?').catch((reason: unknown) => reason)
    expect(error).toBeInstanceOf(Error)
    expect((error as Error).message).toContain('Chat Completions-compatible adapter')
    expect((error as Error).message).not.toContain('private provider details')
    expect(extractCopilotAnswer({ Output: { __type: 'ProviderException', message: 'private provider details' }, Version: '1' })).toBeNull()
  })

  it('accepts common chat, Responses and simple gateway envelopes', () => {
    expect(extractCopilotAnswer({ choices: [{ message: { content: [{ type: 'text', text: 'Primeira parte' }, { type: 'text', text: 'Segunda parte' }] } }] })).toBe('Primeira parte\nSegunda parte')
    expect(extractCopilotAnswer({ output_text: 'Resposta direta' })).toBe('Resposta direta')
    expect(extractCopilotAnswer({ output: [{ content: [{ type: 'output_text', text: 'Resposta em partes' }] }] })).toBe('Resposta em partes')
    expect(extractCopilotAnswer({ output: [{ type: 'reasoning' }, { content: [{ type: 'output_text', text: 'Resposta após raciocínio' }] }] })).toBe('Resposta após raciocínio')
    expect(extractCopilotAnswer({ content: [{ type: 'text', text: 'Resposta em content' }] })).toBe('Resposta em content')
    expect(extractCopilotAnswer({ Output: 'Resposta do endpoint', Version: '1' })).toBe('Resposta do endpoint')
    expect(extractCopilotAnswer({ Output: { answer: 'Resposta aninhada' }, Version: '1' })).toBe('Resposta aninhada')
    expect(extractCopilotAnswer({ answer: 'Resposta do gateway' })).toBe('Resposta do gateway')
    expect(extractCopilotAnswer({ message: { content: 'Resposta local' } })).toBe('Resposta local')
    expect(responseShape({ secret: 'never print', output: [] })).toBe('secret, output')
  })
})
