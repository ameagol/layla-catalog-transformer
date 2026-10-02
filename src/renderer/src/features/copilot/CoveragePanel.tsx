import { useEffect, useState } from 'react'
import type { CopilotCoverage } from '@core/ipc/contracts'

export function CoveragePanel({ analysisId }: { analysisId: string }) {
  const [coverage, setCoverage] = useState<CopilotCoverage | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let active = true
    const timer = window.setTimeout(() => {
      void window.catalogTransformer.reviewCoverage(analysisId).then((result) => {
        if (active) setCoverage(result)
      }).catch(() => { if (active) setFailed(true) })
    }, 450)
    return () => { active = false; window.clearTimeout(timer) }
  }, [analysisId])

  if (failed) return null
  const suggestion = coverage?.candidates.find((item) => item.id === coverage.suggestedId)
  return <section className="rounded-xl border border-[var(--line)] bg-[var(--surface)] px-4 py-3" aria-label="Rule coverage review">
    <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-sm font-semibold">Review rule coverage</h2><span className="text-xs text-[var(--ink-soft)]">{!coverage ? 'Checking locally…' : coverage.source === 'laya' ? 'Laya suggested a focus' : coverage.source === 'needs_review' ? 'Human review recommended' : 'Profile observations'}</span></div>
    {!coverage ? <p role="status" className="mt-1 text-xs text-[var(--ink-soft)]">Checking columns and rules after the analysis.</p> : coverage.candidates.length === 0 ? <p className="mt-1 text-xs text-[var(--ink-soft)]">No additional coverage questions surfaced from the available profile. This does not certify the data.</p> : <>
      <p className="mt-2 text-sm">{suggestion ? suggestion.label : `${coverage.candidates.length} question(s) to consider; none prioritized by Laya.`}</p>
      {suggestion && <p className="mt-1 text-xs text-[var(--ink-soft)]">{suggestion.evidence}</p>}
      <details className="mt-2"><summary className="cursor-pointer text-xs font-semibold text-[var(--signal)]">See all observed coverage questions</summary><div className="mt-2 space-y-2">{coverage.candidates.map((candidate) => <p key={candidate.id} className="text-xs text-[var(--ink-soft)]"><strong className="text-[var(--ink)]">{candidate.label}:</strong> {candidate.evidence}</p>)}</div></details>
    </>}
    <p className="mt-2 text-[11px] text-[var(--ink-soft)]">Coverage suggestions are not rule violations. Confirm whether a new rule is appropriate before acting.</p>
  </section>
}
