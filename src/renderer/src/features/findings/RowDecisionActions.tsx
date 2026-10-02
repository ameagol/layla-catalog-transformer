import { Check, X } from 'lucide-react'

import type { RowDecision } from '@core/model/domain'

import { useAppStore } from '@/stores/useAppStore'

interface RowDecisionActionsProps {
  analysisId: string
  rowNumber: number
  decision?: RowDecision
}

export function RowDecisionActions({ analysisId, rowNumber, decision }: RowDecisionActionsProps) {
  const busy = useAppStore((state) => Boolean(state.busyAction))
  const setRowDecision = useAppStore((state) => state.setRowDecision)

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <button type="button" aria-label={`Accept row ${rowNumber}`} aria-pressed={decision === 'accept'} disabled={busy} onClick={() => setRowDecision(analysisId, rowNumber, 'accept')} className={`inline-flex items-center gap-1 rounded-lg border border-[var(--success)] px-2 py-1.5 text-xs font-semibold transition disabled:opacity-45 ${decision === 'accept' ? 'bg-[var(--success)] text-white' : 'bg-[var(--success-soft)] text-[var(--success)] hover:bg-[var(--success)] hover:text-white'}`}><Check className="size-3" />Accept</button>
        <button type="button" aria-label={`Exclude row ${rowNumber}`} aria-pressed={decision === 'delete'} disabled={busy} onClick={() => setRowDecision(analysisId, rowNumber, 'delete')} className={`inline-flex items-center gap-1 rounded-lg border border-[var(--danger)] px-2 py-1.5 text-xs font-semibold transition disabled:opacity-45 ${decision === 'delete' ? 'bg-[var(--danger)] text-white' : 'bg-[var(--surface-raised)] text-[var(--danger)] hover:bg-[var(--danger-soft)]'}`}><X className="size-3" />Exclude</button>
      </div>
      <p className={`max-w-36 text-[11px] leading-4 ${decision === 'accept' ? 'text-[var(--success)]' : decision === 'delete' ? 'text-[var(--danger)]' : 'text-[var(--ink-soft)]'}`}>{decision === 'accept' ? 'Included; issues stay marked' : decision === 'delete' ? 'Excluded from download' : 'Accept to include in download'}</p>
    </div>
  )
}
