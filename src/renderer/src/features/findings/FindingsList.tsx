import type { FindingReviewGroup } from '@core/model/domain'

import { findingLocation, findingTypeLabel } from './helper'
import { FindingTypeBadge } from './FindingTypeBadge'
import { FINDING_IMPACT_LABELS } from './constants'

interface FindingsListProps {
  findings: FindingReviewGroup[]
  selectedId: string
  onSelect: (findingId: string) => void
}

export function FindingsList({ findings, selectedId, onSelect }: FindingsListProps) {
  return (
    <nav aria-label="Findings" className="min-w-0 border-r border-[var(--line)]">
      <ul className="max-h-[calc(100vh-21rem)] min-h-80 overflow-y-auto">
        {findings.map((finding) => (
          <li key={finding.id} className="border-b border-[var(--line)] last:border-b-0">
            <button
              type="button"
              aria-pressed={finding.id === selectedId}
              aria-label={`${finding.types.map(findingTypeLabel).join(', ')}, ${FINDING_IMPACT_LABELS[finding.impactLevel].label}, ${findingLocation(finding)}`}
              className={`block w-full px-4 py-4 text-left transition ${finding.id === selectedId ? 'bg-[var(--surface-muted)] shadow-[inset_3px_0_0_var(--signal)]' : 'hover:bg-[var(--surface-muted)]/50'}`}
              onClick={() => onSelect(finding.id)}
            >
              <span className="flex items-start justify-between gap-2">
                <span className="flex min-w-0 flex-wrap gap-1.5">{finding.types.map((type) => <FindingTypeBadge key={type} type={type} />)}</span>
                <span aria-label={FINDING_IMPACT_LABELS[finding.impactLevel].label} title={FINDING_IMPACT_LABELS[finding.impactLevel].label} className="mt-0.5 shrink-0 rounded border border-[var(--line-strong)] px-1 py-0.5 font-['JetBrains_Mono_Variable'] text-[9px] font-semibold leading-none text-[var(--ink-soft)]">{FINDING_IMPACT_LABELS[finding.impactLevel].badge}</span>
              </span>
              <span className="mt-1.5 block break-words font-['JetBrains_Mono_Variable'] text-[11px] leading-5 text-[var(--ink-soft)]">{findingLocation(finding)}</span>
            </button>
          </li>
        ))}
      </ul>
    </nav>
  )
}
