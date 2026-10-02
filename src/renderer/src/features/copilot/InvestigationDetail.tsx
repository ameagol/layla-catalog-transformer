import { useEffect, useState, type ReactNode } from 'react'
import { ChevronDown, Columns3 } from 'lucide-react'

import type { CopilotGuidance, CopilotRowContext } from '@core/ipc/contracts'
import type { Finding, WorkbookProfile } from '@core/model/domain'

import { priorityForFinding } from './triage'
import { CaseInsight } from './CaseInsight'
import { findingTypeLabel } from '@/features/findings/helper'

export function InvestigationDetail({ analysisId, finding, workbook, guidance, assistant, fullEvidence }: {
  analysisId: string
  finding: Finding
  workbook: WorkbookProfile
  guidance: CopilotGuidance | null
  assistant: ReactNode
  fullEvidence: ReactNode
}) {
  const evidenceKeys = [...new Set(finding.evidence.map((cell) => cell.columnKey))]
  const [columnKeys, setColumnKeys] = useState<string[]>(evidenceKeys.slice(0, 4))
  const [context, setContext] = useState<CopilotRowContext | null>(null)
  const [error, setError] = useState('')
  const [activeColumn, setActiveColumn] = useState<string | null>(null)
  const [activeRow, setActiveRow] = useState<number | null>(null)
  const [fullOpen, setFullOpen] = useState(false)

  useEffect(() => {
    setColumnKeys(evidenceKeys.slice(0, 4))
    setActiveColumn(null)
    setActiveRow(null)
  }, [analysisId, finding.id])

  useEffect(() => {
    let active = true
    setContext(null)
    setError('')
    void window.catalogTransformer.getCopilotRows(analysisId, finding.id, columnKeys).then((value) => {
      if (active) setContext(value)
    }).catch(() => { if (active) setError('Could not retrieve these rows. Reopen the workbook and run the analysis again.') })
    return () => { active = false }
  }, [analysisId, finding.id, columnKeys])

  const columns = workbook.selectedSheet.columns
  const available = columns.filter((column) => !columnKeys.includes(column.key))
  const priority = priorityForFinding(finding)
  return <article className="copilot-case min-w-0 space-y-5 p-5" aria-label="Investigation case">
    <header className="space-y-3">
      <div className="flex flex-wrap items-center gap-2"><span className="text-xs font-semibold text-[var(--ink-soft)]">{findingTypeLabel(finding.type)} · {priority.label} priority · {finding.confidence.toLowerCase()} detection confidence</span></div>
      <h3 className="font-['Fraunces_Variable'] text-2xl font-semibold leading-tight">Review rows {finding.rowNumbers.slice(0, 5).join(' · ')}{finding.rowNumbers.length > 5 ? '…' : ''}</h3>
      <p className="text-sm leading-6 text-[var(--ink-soft)]">{finding.explanation}</p>
    </header>

    <CaseInsight analysisId={analysisId} finding={finding} guidance={guidance} questions={assistant} />

    <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface-muted)] p-4">
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider"><Columns3 className="size-4 text-[var(--signal)]" />Compare selected columns</div>
      <p className="mt-1 text-xs text-[var(--ink-soft)]">Only values from affected rows are loaded. Select up to 8 columns for context.</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {columnKeys.map((key) => <button type="button" key={key} aria-label={`Remove ${columns.find((column) => column.key === key)?.header ?? key}`} className={`rounded-lg border px-2.5 py-1.5 text-xs transition-colors ${activeColumn === key ? 'border-[var(--signal)] bg-[var(--signal-soft)]' : 'border-[var(--line)] bg-[var(--surface)] hover:border-[var(--signal)]'}`} onClick={() => setColumnKeys((current) => current.filter((item) => item !== key))}>{columns.find((column) => column.key === key)?.header ?? key} <span aria-hidden="true">×</span></button>)}
        <label className="sr-only" htmlFor="copilot-add-column">Add a column to compare</label>
        <select id="copilot-add-column" aria-label="Add a column to compare" className="max-w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2 py-1.5 text-xs" value="" disabled={columnKeys.length >= 8 || !available.length} onChange={(event) => { const key = event.target.value; if (key) { setColumnKeys((current) => [...current, key]); setActiveColumn(key) } }}><option value="">+ Add column</option>{available.map((column) => <option key={column.key} value={column.key}>{column.header}</option>)}</select>
      </div>
      {error && <p role="alert" className="mt-3 text-xs text-[var(--danger)]">{error}</p>}
      {!context && !error && <p role="status" className="copilot-breathe mt-4 text-xs text-[var(--ink-soft)]">Loading selected cells…</p>}
      {context && <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {context.rows.map((row) => <div key={row.rowNumber} className={`rounded-xl border p-3 transition-all ${activeRow === row.rowNumber ? 'border-[var(--signal)] bg-[var(--signal-soft)]' : 'border-[var(--line)] bg-[var(--surface)]'}`}>
          <button type="button" className="mb-2 text-left text-xs font-bold text-[var(--signal)]" onClick={() => setActiveRow(row.rowNumber)}>Excel row {row.rowNumber} · {finding.sheet}</button>
          {context.columns.map((column) => <button type="button" key={column.key} className={`flex w-full min-w-0 gap-2 border-t border-[var(--line)] py-2 text-left text-xs transition-colors ${activeColumn === column.key ? 'text-[var(--signal)]' : ''}`} onClick={() => { setActiveRow(row.rowNumber); setActiveColumn(column.key) }}><span className="w-24 shrink-0 truncate text-[var(--ink-soft)]" title={column.header}>{column.header}</span><span className="min-w-0 break-all font-semibold">{row.values[column.key] || 'Empty'}</span></button>)}
          {!context.columns.length && <p className="text-xs text-[var(--ink-soft)]">Select a column above to inspect this row.</p>}
        </div>)}
        {!context.rows.length && <p className="text-xs text-[var(--ink-soft)]">No source rows available for this case.</p>}
      </div>}
    </section>

    <details className="rounded-xl border border-[var(--line)]" onToggle={(event) => setFullOpen(event.currentTarget.open)}><summary className="flex cursor-pointer items-center justify-between p-4 text-sm font-semibold">Full rule and normalized evidence <ChevronDown className="size-4" /></summary>{fullOpen && fullEvidence}</details>
  </article>
}
