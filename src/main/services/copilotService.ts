import { allowedGuidanceRoutes, comparisonSignals, layaGuidance, localGuidance, selectCurrentFinding } from '@core/copilot/guidance'
import { coverageCandidates, selectCoverageSuggestion } from '@core/copilot/coverage'
import type { CopilotGuidance } from '@core/copilot/guidance'
import type { CopilotCoverage, CopilotRowContext, CopilotStatus } from '@core/ipc/contracts'
import type { CopilotAnswer } from '@core/ipc/contracts'
import { copilotSystemPrompt, extractCopilotAnswer, findingContext, responseShape } from '@core/copilot/aiContract'

import { AnalysisService } from './analysisService'
import { SettingsStore } from './settingsStore'
import { WorkbookService } from './workbookService'
import { LayaService } from './layaService'
import { stringifyCellValue } from '@core/normalization/normalizers'
import { ChatPromptTemplate } from '@langchain/core/prompts'
import { RunnableLambda } from '@langchain/core/runnables'

type LayaAgent = Pick<LayaService, 'predict'>

export class CopilotService {
  private pending: Promise<unknown> = Promise.resolve()

  constructor(private readonly analysis: AnalysisService, private readonly settings: SettingsStore, userDataPath = '', private readonly workbooks?: WorkbookService, private readonly laya: Pick<LayaService, 'ready' | 'predict'> = new LayaService(userDataPath)) {}

  async rows(analysisId: string, findingId: string, columnKeys: string[]): Promise<CopilotRowContext> {
    const result = this.analysis.getActiveResult(analysisId)
    const finding = selectCurrentFinding(result, analysisId, findingId)
    if (!this.workbooks) throw new Error('Workbook context is unavailable.')
    const dataset = await this.workbooks.getWorksheetData(result.sessionId, result.sheetName)
    const columns = columnKeys.map((key) => {
      const column = dataset.profile.columns.find((item) => item.key === key)
      if (!column) throw new Error('Selected column does not belong to the active worksheet.')
      return { key: column.key, header: column.header }
    })
    const selectedRows = new Set(finding.rowNumbers.slice(0, 20))
    return {
      columns,
      rows: dataset.rows.filter((row) => selectedRows.has(row.rowNumber)).map((row) => ({
        rowNumber: row.rowNumber,
        values: Object.fromEntries(columns.map((column) => [column.key, stringifyCellValue(row.values[column.key] ?? null).slice(0, 300)]))
      }))
    }
  }

  private async agent(): Promise<LayaAgent> {
    await this.laya.ready()
    return this.laya
  }

  async coverage(analysisId: string): Promise<CopilotCoverage> {
    const result = this.analysis.getActiveResult(analysisId)
    if (!this.workbooks) throw new Error('Workbook context is unavailable.')
    const { profile } = await this.workbooks.getWorksheetData(result.sessionId, result.sheetName)
    const candidates = coverageCandidates(profile, result.compilation)
    if (!candidates.length) return { candidates, suggestedId: null, source: 'local' }
    let agent: LayaAgent
    try { agent = await this.agent() }
    catch { return { candidates, suggestedId: null, source: 'local' } }
    const criteria = Object.fromEntries([
      ...candidates.map((candidate) => [candidate.id, `${candidate.label}: ${candidate.evidence}`]),
      ['needs_review', 'No option has enough evidence for a prioritized suggestion']
    ])
    const run = this.pending.then(() => agent.predict(
      JSON.stringify({ worksheet: profile.name.slice(0, 100), rows: profile.rowCount, candidates: candidates.map((item) => ({ id: item.id, evidence: item.evidence })) }),
      { focus: { type: 'choice', instructions: 'Which already observed coverage question is most useful to review next? Never claim an untested row violates a rule; abstain if uncertain.', criteria } },
      { lang: 'en', minConfidence: 0.8 }
    ))
    this.pending = run.catch(() => undefined)
    let timeout: ReturnType<typeof setTimeout> | undefined
    try {
      const result = await Promise.race([
        run,
        new Promise<never>((_, reject) => { timeout = setTimeout(() => reject(new Error('Laya coverage timeout')), 20_000) })
      ])
      const answer = result.answers.focus
      const suggestedId = answer?.type === 'choice'
        ? selectCoverageSuggestion(candidates, answer.choice, answer.answer_confidence, result.usage.truncated)
        : null
      return { candidates, suggestedId, source: suggestedId ? 'laya' : 'needs_review' }
    } catch { return { candidates, suggestedId: null, source: 'needs_review' } }
    finally { clearTimeout(timeout) }
  }

  async status(): Promise<CopilotStatus> {
    const settings = await this.settings.get()
    let laya: CopilotStatus['laya'] = 'ready'
    let layaDetail = 'Local Laya model loaded and verified.'
    try { await this.agent() } catch { laya = 'unavailable'; layaDetail = 'Local Laya unavailable: ONNX model not validated or incompatible runtime.' }
    if (settings.copilot.endpoint && settings.copilot.model) {
      return { status: 'available', detail: 'Chat endpoint configured. Responses depend on the external service.', laya, layaDetail }
    }
    return {
      status: 'unavailable',
      detail: 'Configure a chat endpoint and model in Settings to enable AI answers.', laya, layaDetail
    }
  }

  async guide(analysisId: string, findingId: string): Promise<CopilotGuidance> {
    const result = this.analysis.getActiveResult(analysisId)
    const finding = selectCurrentFinding(result, analysisId, findingId)
    const interpretation = result.compilation?.interpretations.find((item) => item.id === finding.ruleId)
    const ruleNeedsReview = Boolean(interpretation && (interpretation.status !== 'valid' || interpretation.warnings.length))
    let signals: string[] = []
    if (finding.type === 'POSSIBLE_DUPLICATE' && this.workbooks) {
      try {
        const dataset = await this.workbooks.getWorksheetData(result.sessionId, result.sheetName)
        const evidenceKeys = new Set(finding.evidence.map((item) => item.columnKey))
        const contextKeys = dataset.profile.columns.filter((column) => !evidenceKeys.has(column.key))
          .sort((a, b) => b.uniquenessRatio - a.uniquenessRatio).slice(0, 4).map((column) => column.key)
        signals = comparisonSignals(finding, await this.rows(analysisId, findingId, contextKeys))
      } catch { /* Stale workbook context cannot invalidate a finding already detected. */ }
    }
    let agent: LayaAgent
    try { agent = await this.agent() } catch { return { ...localGuidance(finding), signals } }
    // One decision per finding, with no raw workbook rows or cell values sent to the model.
    const state = JSON.stringify({ type: finding.type, rule: finding.ruleText.slice(0, 500),
      fields: finding.fields.slice(0, 10), confidence: finding.confidence, observations: signals })
    const routeDescriptions = {
      review_duplicate: 'Comparar registros na fonte para verificar se são a mesma entidade',
      verify_source: 'Conferir um valor inconsistente ou inválido na fonte',
      complete_attribute: 'Consultar a fonte para completar um atributo ausente',
      check_relationship: 'Conferir se são registros relacionados mas distintos',
      review_rule: 'Revisar a regra ou mapeamento da coluna antes de propor correção',
      human_review: 'Informação insuficiente; exigir revisão humana sem afirmar erro'
    }
    const allowed = Object.fromEntries(allowedGuidanceRoutes(finding, signals, ruleNeedsReview)
      .map((route) => [route, routeDescriptions[route]]))
    const questions = { route: {
      type: 'choice',
      instructions: 'Qual o próximo passo prudente para investigar este achado de qualidade? Não confirme uma correção nem reavalie se a regra foi violada. Se faltar evidência, escolha revisão humana.',
      criteria: allowed
    } }
    const run = this.pending.then(() => agent.predict(state, questions, { lang: 'pt', minConfidence: 0.8 }))
    this.pending = run.catch(() => undefined)
    let timeout: ReturnType<typeof setTimeout> | undefined
    try {
      const result = await Promise.race([
        run,
        new Promise<never>((_, reject) => { timeout = setTimeout(() => reject(new Error('Laya timeout')), 20_000) })
      ])
      const answer = result.answers.route
      const guidance = answer?.type === 'choice' && !result.usage.truncated
        ? layaGuidance(finding, answer.choice, answer.answer_confidence, signals, ruleNeedsReview)
        : layaGuidance(finding, null, null, signals, ruleNeedsReview)
      return { ...guidance, signals }
    } catch {
      return { ...localGuidance(finding, 'human_review'), status: 'needs_review', signals }
    } finally {
      clearTimeout(timeout)
    }
  }

  async ask(analysisId: string, findingId: string, question: string): Promise<CopilotAnswer> {
    const finding = selectCurrentFinding(this.analysis.getActiveResult(analysisId), analysisId, findingId)
    const settings = await this.settings.get()
    const { endpoint, model, sendFindingEvidence } = settings.copilot
    if (!endpoint || !model) throw new Error('Configure the Copilot endpoint and model in Settings.')
    let url: URL
    try { url = new URL(endpoint) } catch { throw new Error('The Copilot URL is invalid.') }
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
    if (url.protocol !== 'https:' && !(url.protocol === 'http:' && local)) {
      throw new Error('The Copilot endpoint must use HTTPS, except on localhost.')
    }
    if (url.username || url.password || url.hash) throw new Error('The Copilot URL must not contain credentials or a fragment.')
    // A common configuration is an OpenAI-compatible API base URL. Never rewrite other paths.
    if (/\/v1\/?$/u.test(url.pathname)) url.pathname = `${url.pathname.replace(/\/$/u, '')}/chat/completions`

    const apiKey = await this.settings.getCopilotSecret()
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 30_000)
    try {
      // LangChain formats a grounded prompt; the transport remains our validated, provider-compatible adapter.
      const prompt = ChatPromptTemplate.fromMessages([
        ['system', copilotSystemPrompt],
        ['human', '{context}']
      ])
      const chain = prompt.pipe(new RunnableLambda({ func: async (value: Awaited<ReturnType<typeof prompt.invoke>>) => {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {})
          },
          body: JSON.stringify({
            model,
            messages: value.toChatMessages().map((message) => ({
              role: message._getType() === 'system' ? 'system' : 'user', content: message.content
            }))
          }),
          signal: controller.signal
        })
        if (!response.ok) throw new Error(response.status === 400
          ? 'The AI service returned HTTP 400. Verify that the configured model supports Chat Completions at this endpoint. No model-specific parameters were sent.'
          : `The AI service returned HTTP ${response.status}.`)
        const contentType = response.headers?.get('content-type') ?? ''
        if (contentType.includes('text/event-stream')) throw new Error('The service returned a stream; configure a non-streaming JSON response.')
        try { return await response.json() as unknown }
        catch { throw new Error('The service did not return valid JSON. Check the chat endpoint.') }
      } }))
      const payload = await chain.invoke({ context: JSON.stringify({ question, finding: findingContext(finding, sendFindingEvidence) }) })
       const answer = extractCopilotAnswer(payload)
       if (!answer && payload && typeof payload === 'object' && 'Output' in payload) {
         const output = (payload as { Output: unknown }).Output
         if (output && typeof output === 'object' && '__type' in output) {
           throw new Error('The chat endpoint returned a typed Output object without answer text. This may be a provider error or an incompatible response contract. Check the endpoint logs and configure a Chat Completions-compatible adapter.')
         }
       }
       if (!answer) throw new Error(`Unrecognized response format (fields: ${responseShape(payload)}). Check the chat endpoint contract.`)
      return { source: 'ai', answer, model }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') throw new Error('The AI response timed out after 30 seconds.')
      throw error
    } finally {
      clearTimeout(timeout)
    }
  }
}
