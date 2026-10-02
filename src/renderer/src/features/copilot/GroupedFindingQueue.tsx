import { useEffect, useMemo, useState } from 'react'
import { ChevronDown } from 'lucide-react'

import type { Finding } from '@core/model/domain'

import { findingTypeLabel } from '@/features/findings/helper'

import { groupFindings } from './groupFindings'
import { priorityForFinding } from './triage'

export function GroupedFindingQueue({ findings, selectedId, onSelect }: { findings: Finding[]; selectedId: string | null; onSelect: (finding: Finding) => void }) {
  const groups = useMemo(() => groupFindings(findings), [findings])
  const [expanded, setExpanded] = useState<string[]>([])
  const [visibleGroups, setVisibleGroups] = useState(20)
  const [visibleCases, setVisibleCases] = useState<Record<string, number>>({})

  useEffect(() => {
    if (!groups[0] || expanded.some((key) => groups.some((group) => group.key === key))) return
    const selectedGroup = groups.find((group) => group.findings.some((finding) => finding.id === selectedId))
    setExpanded([selectedGroup?.key ?? groups[0].key])
  }, [groups])

  function toggle(key: string) {
    setExpanded((previous) => previous.includes(key) ? previous.filter((item) => item !== key) : [...previous, key])
  }

  return <div className="max-h-[720px] overflow-y-auto border-b border-[var(--line)] lg:border-b-0 lg:border-r" aria-label="Grouped problems">
    <p className="border-b border-[var(--line)] bg-[var(--surface-muted)] px-4 py-2 text-xs font-semibold text-[var(--ink-soft)]">{groups.length} problem(s) · expand to review affected records</p>
    {groups.slice(0, visibleGroups).map((group) => {
      const open = expanded.includes(group.key)
      const highest = group.findings[0]!
      const priority = priorityForFinding(highest)
      return <section key={group.key} className="border-b border-[var(--line)]">
        <button type="button" aria-expanded={open} className="w-full p-4 text-left transition hover:bg-[var(--surface-muted)]" onClick={() => toggle(group.key)}>
          <div className="flex items-start justify-between gap-2"><span className="text-xs text-[var(--ink-soft)]">{findingTypeLabel(group.type)} · {priority.label} priority</span><ChevronDown className={`size-4 shrink-0 text-[var(--ink-soft)] transition ${open ? 'rotate-180' : ''}`} /></div>
          <p className="mt-2 line-clamp-2 text-sm font-semibold leading-5">{group.ruleText}</p>
          <p className="mt-1 text-xs text-[var(--ink-soft)]">{group.findings.length} cases · {group.affectedRows} rows</p>
        </button>
        {open && <div className="border-t border-[var(--line)] bg-[var(--surface-muted)]/50">
          {group.findings.slice(0, Math.max(visibleCases[group.key] ?? 30, group.findings.findIndex((item) => item.id === selectedId) + 1)).map((finding, index) => <button key={finding.id} type="button" aria-current={selectedId === finding.id ? 'true' : undefined} className={`w-full border-b border-[var(--line)] px-5 py-3 text-left text-xs transition hover:bg-[var(--surface-raised)] ${selectedId === finding.id ? 'bg-[var(--signal-soft)] shadow-[inset_3px_0_0_var(--signal)]' : ''}`} onClick={() => onSelect(finding)}><span className="font-semibold">Case {index + 1} · row(s) {finding.rowNumbers.slice(0, 3).join(', ')}{finding.rowNumbers.length > 3 ? '…' : ''}</span></button>)}
          {group.findings.length > (visibleCases[group.key] ?? 30) && <button type="button" className="w-full px-5 py-3 text-left text-xs text-[var(--signal)]" onClick={() => setVisibleCases((current) => ({ ...current, [group.key]: (current[group.key] ?? 30) + 30 }))}>Show more cases</button>}
        </div>}
      </section>
    })}
    {groups.length > visibleGroups && <button type="button" className="w-full p-4 text-left text-xs font-semibold text-[var(--signal)]" onClick={() => setVisibleGroups((count) => count + 20)}>Show more groups</button>}
  </div>
}
