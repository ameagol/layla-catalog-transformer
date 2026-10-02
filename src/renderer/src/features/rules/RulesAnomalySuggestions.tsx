import { useState } from 'react'
import type { AnomalyScanResult, GovernancePillar, GovernanceRuleDraft } from '@core/anomaly/types'
import { useAppStore } from '@/stores/useAppStore'

interface RulesAnomalySuggestionsProps {
  anomalyScan: AnomalyScanResult | null
  scanning: boolean
}

const PILLAR_LABELS: Record<GovernancePillar, string> = {
  primary_key: 'Key',
  essential_field: 'Required',
  type_validation: 'Standard',
  status_dependency: 'State'
}

export function RulesAnomalySuggestions({ anomalyScan, scanning }: RulesAnomalySuggestionsProps) {
  const [addedRules, setAddedRules] = useState<Set<string>>(new Set())
  const addDraftRuleToProject = useAppStore((state) => state.addDraftRuleToProject)
  const busyAction = useAppStore((state) => state.busyAction)

  const handleAddRule = async (ruleText: string) => {
    setAddedRules((prev) => new Set(prev).add(ruleText))
    await addDraftRuleToProject(ruleText)
  }

  return (
    <div className="flex h-[560px] flex-col overflow-hidden rounded-[22px] border border-[var(--line)] bg-[var(--surface)] shadow-[var(--shadow-tight)]">
      <div className="border-b border-[var(--line)] px-6 py-5">
        <h3 className="font-['Fraunces_Variable'] text-xl font-semibold tracking-[-0.02em] text-[var(--ink)]">
          Suggested rules
        </h3>
        <p className="mt-1 text-sm leading-6 text-[var(--ink-soft)]">
          Invariants inferred from dataset.
        </p>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {scanning ? (
          <div className="flex h-full items-center justify-center py-8 text-center text-sm text-[var(--ink-soft)]">
            Analyzing dataset invariants…
          </div>
        ) : !anomalyScan || anomalyScan.draftRules.length === 0 ? (
          <div className="flex h-full items-center justify-center py-8 text-center text-sm text-[var(--ink-soft)]">
            No suggestions for this dataset.
          </div>
        ) : (
          <div className="space-y-3">
            {anomalyScan.draftRules.map((draft: GovernanceRuleDraft) => {
              const isAdded = addedRules.has(draft.ruleText)
              const pillarLabel = PILLAR_LABELS[draft.pillar] ?? 'Rule'

              return (
                <div
                  key={draft.ruleText}
                  className="flex flex-col justify-between rounded-xl border border-[var(--line)] bg-[var(--surface-raised)] p-3.5 text-sm transition hover:border-[var(--line-strong)]"
                >
                  <div>
                    <div className="flex flex-wrap items-center justify-between gap-1.5">
                      <span className="text-xs font-semibold uppercase tracking-wider text-[var(--ink-soft)]">
                        {pillarLabel}
                      </span>
                      <span className="max-w-full truncate font-mono text-xs text-[var(--ink-soft)]" title={draft.columnHeader}>
                        {draft.columnHeader}
                      </span>
                    </div>

                    <p className="mt-2 font-['JetBrains_Mono_Variable'] text-[13px] font-semibold leading-relaxed text-[var(--ink)] break-words [overflow-wrap:anywhere]">
                      {draft.ruleText}
                    </p>

                    <p className="mt-1 text-xs leading-normal text-[var(--ink-soft)] break-words">
                      {draft.reason}
                    </p>
                  </div>

                  <div className="mt-3 flex items-center justify-end border-t border-[var(--line)]/50 pt-2.5">
                    <button
                      type="button"
                      disabled={isAdded || Boolean(busyAction)}
                      onClick={() => void handleAddRule(draft.ruleText)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                        isAdded
                          ? 'bg-[var(--success-soft)] text-[var(--success)] cursor-default'
                          : 'border border-[var(--line)] bg-[var(--surface)] text-[var(--ink)] hover:border-[var(--line-strong)]'
                      }`}
                    >
                      {isAdded ? 'Added' : 'Add rule'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

