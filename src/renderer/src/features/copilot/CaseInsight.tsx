import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'

import type { CopilotAnswer, CopilotGuidance } from '@core/ipc/contracts'
import type { Finding } from '@core/model/domain'
import { impactForFinding, ownerForFinding } from './triage'
import { useAppStore } from '@/stores/useAppStore'

const consentKey = 'catalog-transformer:automatic-case-explanations'
const answers = new Map<string, CopilotAnswer>()
const failedProviders = new Map<string, string>()
const layaAnswers = new Map<string, CopilotGuidance>()

function consentMatches(endpoint: string, model: string): boolean {
  try {
    const saved = JSON.parse(window.localStorage.getItem(consentKey) ?? 'null') as { endpoint?: string; model?: string } | null
    return saved?.endpoint === endpoint && saved?.model === model
  } catch { return false }
}

export function CaseInsight({ analysisId, finding, guidance, questions }: {
  analysisId: string
  finding: Finding
  guidance: CopilotGuidance | null
  questions: ReactNode
}) {
  const config = useAppStore((s) => s.settings?.copilot)
  const endpoint = config?.endpoint ?? ''
  const model = config?.model ?? ''
  const configured = Boolean(endpoint && model)
  const [enabled, setEnabled] = useState(() => consentMatches(endpoint, model))
  const [answer, setAnswer] = useState<CopilotAnswer | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [layaGuidance, setLayaGuidance] = useState<CopilotGuidance | null>(() => layaAnswers.get(`${analysisId}:${finding.id}`) ?? null)
  const [layaPending, setLayaPending] = useState(false)
  const review = layaGuidance ?? guidance

  useEffect(() => {
    const key = `${analysisId}:${finding.id}`
    const cached = layaAnswers.get(key)
    if (cached) { setLayaGuidance(cached); return }
    let active = true
    const timer = window.setTimeout(() => {
      setLayaPending(true)
      void window.catalogTransformer.guideFinding(analysisId, finding.id).then((result) => {
        if (!active) return
        if (layaAnswers.size >= 30) layaAnswers.delete(layaAnswers.keys().next().value ?? '')
        layaAnswers.set(key, result)
        setLayaGuidance(result)
      }).catch(() => {
        if (active) setLayaGuidance({ status: 'needs_review', route: 'human_review', impact: '', nextStep: 'Confirm the rule and source records.' })
      }).finally(() => { if (active) setLayaPending(false) })
    }, 900)
    return () => { active = false; window.clearTimeout(timer) }
  }, [analysisId, finding.id])

  useEffect(() => { setAnswer(null); setError('') }, [analysisId, finding.id, endpoint, model])
  useEffect(() => { setEnabled(consentMatches(endpoint, model)) }, [endpoint, model])
  useEffect(() => {
    if (!enabled || !configured) return
    const key = `${analysisId}:${finding.id}:${endpoint}:${model}`
    const providerKey = `${endpoint}:${model}`
    const cached = answers.get(key)
    if (cached) { setAnswer(cached); return }
    const previousFailure = failedProviders.get(providerKey)
    if (previousFailure) { setError(previousFailure); return }
    let active = true
    setPending(true)
    setError('')
    const prompt = 'Briefly explain this rule-detected finding, its possible impact at the configured impact level (Medium by default), and the next source check. Do not invent domain context, monetary amounts, a confirmed correction, or a named owner.'
    void window.catalogTransformer.askFinding(analysisId, finding.id, prompt).then((response) => {
      if (!active) return
      if (answers.size >= 30) answers.delete(answers.keys().next().value ?? '')
      answers.set(key, response)
      failedProviders.delete(providerKey)
      setAnswer(response)
    }).catch((cause: unknown) => {
      if (active) {
        const message = cause instanceof Error ? cause.message : 'The configured AI endpoint did not respond.'
        failedProviders.set(providerKey, message)
        setError(message)
      }
    }).finally(() => { if (active) setPending(false) })
    return () => { active = false }
  }, [analysisId, finding.id, endpoint, model, enabled, configured, attempt])

  function toggle() {
    if (enabled) {
      window.localStorage.removeItem(consentKey)
      setEnabled(false)
      setAnswer(null)
    } else {
      window.localStorage.setItem(consentKey, JSON.stringify({ endpoint, model }))
      setEnabled(true)
    }
  }

  return <section className="rounded-xl border border-[var(--line)] bg-[var(--surface-raised)] p-4" aria-label="Case guidance">
    <div className="flex flex-wrap items-center justify-between gap-2"><h4 className="text-sm font-bold">What this means</h4><span className="text-xs text-[var(--ink-soft)]">{answer ? `AI · ${answer.model}` : 'Rule-based · local'}</span></div>
    {answer ? <p className="copilot-case mt-3 whitespace-pre-wrap text-sm leading-6">{answer.answer}</p> : <p className="mt-3 text-sm leading-6">{impactForFinding(finding)} {review?.nextStep ?? finding.suggestedAction}</p>}
    <p className="mt-3 border-t border-[var(--line)] pt-3 text-xs text-[var(--ink-soft)]">Business impact: <strong className="text-[var(--ink)]">{finding.impactLevel?.replace(/^./u, (letter) => letter.toUpperCase()) ?? 'Medium'}</strong> (configured for this rule; Medium by default) · Suggested reviewer: {ownerForFinding(finding)}.</p>
    <div className="mt-3 text-xs text-[var(--ink-soft)]">
      <p>{layaPending ? 'Laya is checking the next review step locally…' : layaGuidance?.status === 'laya' ? `Laya suggests: ${layaGuidance.nextStep}` : layaGuidance?.status === 'needs_review' ? 'Laya abstained; review the source.' : layaGuidance?.status === 'unavailable' ? 'Local rule-based route; Laya unavailable.' : 'Local rule-based route; Laya will review this case shortly.'}</p>
      {Boolean(review?.signals?.length) && <details className="mt-2"><summary className="cursor-pointer">Signals considered for this pair</summary><div className="mt-2 space-y-1">{review?.signals?.map((signal) => <p key={signal}>{signal}</p>)}</div></details>}
    </div>
    {pending && <p role="status" className="copilot-breathe mt-3 text-xs text-[var(--signal)]">Generating an explanation for this case…</p>}
    {error && <div role="alert" className="mt-3 text-xs text-[var(--warning)]">AI explanation unavailable: {error} The rule-based guidance above remains valid. <button type="button" className="underline" onClick={() => { failedProviders.delete(`${endpoint}:${model}`); setAttempt((value) => value + 1) }}>Retry</button></div>}
    {!configured && <p className="mt-3 text-xs text-[var(--ink-soft)]">To add AI explanations, <Link to="/settings" className="underline">configure a compatible chat endpoint</Link>.</p>}
    {configured && <button type="button" className="mt-3 text-left text-xs font-semibold text-[var(--signal)] underline underline-offset-2" onClick={toggle}>{enabled ? 'Turn off automatic AI explanations' : 'Enable automatic AI explanations for selected cases'}</button>}
    {configured && !enabled && <p className="mt-1 text-xs text-[var(--ink-soft)]">When enabled, each selected case sends its limited finding metadata to {model} at the configured endpoint. Cell values stay local unless separately allowed in Settings.</p>}
    <details className="mt-3 border-t border-[var(--line)] pt-3"><summary className="cursor-pointer text-xs font-semibold">Ask a follow-up question</summary><div className="mt-3">{questions}</div></details>
  </section>
}
