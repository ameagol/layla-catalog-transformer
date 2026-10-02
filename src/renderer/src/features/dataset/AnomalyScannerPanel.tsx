import { useState } from 'react'
import { AlertTriangle, Check, Sparkles, PlusCircle, Search } from 'lucide-react'
import type { AnomalyScanResult, DetectedAnomaly } from '@core/anomaly/types'
import { ActionButton } from '@/shared/components/ActionButton'
import { useAppStore } from '@/stores/useAppStore'

interface AnomalyScannerPanelProps {
  scanResult: AnomalyScanResult | null
  scanning: boolean
  onScan: () => void
}

export function AnomalyScannerPanel({ scanResult, scanning, onScan }: AnomalyScannerPanelProps) {
  const [filterCategory, setFilterCategory] = useState<string>('all')
  const [addedRules, setAddedRules] = useState<Set<string>>(new Set())
  const addDraftRuleToProject = useAppStore((state) => state.addDraftRuleToProject)

  const handleAddRule = async (ruleText: string) => {
    setAddedRules((prev) => new Set(prev).add(ruleText))
    await addDraftRuleToProject(ruleText)
  }

  const anomalies = scanResult?.anomalies ?? []
  const filtered = filterCategory === 'all'
    ? anomalies
    : anomalies.filter((a) => a.category === filterCategory)

  return (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="size-5 text-[var(--signal)]" />
            <h3 className="font-['Fraunces_Variable'] text-lg font-semibold">
              Autonomous Anomaly & Health Scan
            </h3>
          </div>
          <p className="mt-1 text-xs text-[var(--ink-soft)]">
            Statistical (MAD), syntactic format clustering, data type voting and atypical missing patterns without predefined rules.
          </p>
        </div>
        <ActionButton
          type="button"
          tone="primary"
          icon={<Search className="size-4" />}
          disabled={scanning}
          onClick={onScan}
        >
          {scanning ? 'Scanning…' : scanResult ? 'Re-scan dataset' : 'Scan for anomalies'}
        </ActionButton>
      </div>

      {scanResult && (
        <div className="mt-5 space-y-5">
          {/* Summary badges */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-lg border border-[var(--line)] bg-[var(--surface-muted)] p-3">
              <span className="text-[10px] uppercase tracking-wider text-[var(--ink-soft)]">Total Anomalies</span>
              <p className="text-xl font-bold">{scanResult.summary.totalAnomalies}</p>
            </div>
            <div className="rounded-lg border border-[var(--line)] bg-[var(--surface-muted)] p-3">
              <span className="text-[10px] uppercase tracking-wider text-[var(--ink-soft)]">Outliers (MAD)</span>
              <p className="text-xl font-bold">{scanResult.summary.byCategory.NUMERIC_OUTLIER ?? 0}</p>
            </div>
            <div className="rounded-lg border border-[var(--line)] bg-[var(--surface-muted)] p-3">
              <span className="text-[10px] uppercase tracking-wider text-[var(--ink-soft)]">Format Deviations</span>
              <p className="text-xl font-bold">{scanResult.summary.byCategory.FORMAT_DEVIATION ?? 0}</p>
            </div>
            <div className="rounded-lg border border-[var(--line)] bg-[var(--surface-muted)] p-3">
              <span className="text-[10px] uppercase tracking-wider text-[var(--ink-soft)]">Atypical Nulls</span>
              <p className="text-xl font-bold">{scanResult.summary.byCategory.ATYPICAL_MISSING ?? 0}</p>
            </div>
          </div>

          {/* Smart Draft Rules Suggestion */}
          {scanResult.draftRules.length > 0 && (
            <div className="rounded-xl border border-[var(--accent)]/30 bg-[var(--accent)]/5 p-4">
              <div className="flex items-center gap-2">
                <Sparkles className="size-4 text-[var(--accent)]" />
                <h4 className="text-sm font-semibold">Smart Rule Suggestions (Auto-drafted from Data)</h4>
              </div>
              <p className="mt-1 text-xs text-[var(--ink-soft)]">
                Promote detected patterns directly into your rules catalog with Laya validation.
              </p>
              <div className="mt-3 space-y-2">
                {scanResult.draftRules.map((draft) => {
                  const isAdded = addedRules.has(draft.ruleText)
                  return (
                    <div
                      key={draft.ruleText}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-xs"
                    >
                      <div className="min-w-0 flex-1">
                        <code className="font-semibold text-[var(--ink)]">{draft.ruleText}</code>
                        <p className="mt-0.5 text-[var(--ink-soft)]">{draft.reason}</p>
                      </div>
                      <button
                        type="button"
                        disabled={isAdded}
                        onClick={() => void handleAddRule(draft.ruleText)}
                        className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 font-semibold transition ${
                          isAdded
                            ? 'bg-[var(--success-soft)] text-[var(--success)] cursor-default'
                            : 'bg-[var(--surface-raised)] border border-[var(--line)] hover:border-[var(--line-strong)] text-[var(--ink)]'
                        }`}
                      >
                        {isAdded ? (
                          <>
                            <Check className="size-3.5" /> Added to Rules
                          </>
                        ) : (
                          <>
                            <PlusCircle className="size-3.5" /> Add Rule
                          </>
                        )}
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Anomaly list with filter */}
          <div>
            <div className="flex items-center justify-between gap-2 border-b border-[var(--line)] pb-2 text-xs">
              <span className="font-semibold text-[var(--ink-soft)]">
                Detected Anomalies ({filtered.length})
              </span>
              <div className="flex items-center gap-2">
                <span className="text-[var(--ink-soft)]">Filter:</span>
                <select
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                  className="rounded border border-[var(--line)] bg-[var(--surface-raised)] px-2 py-1 text-xs"
                >
                  <option value="all">All categories</option>
                  <option value="NUMERIC_OUTLIER">Numeric Outlier</option>
                  <option value="FORMAT_DEVIATION">Format Deviation</option>
                  <option value="DATA_TYPE_INCONSISTENCY">Data Type Inconsistency</option>
                  <option value="ATYPICAL_MISSING">Atypical Null</option>
                </select>
              </div>
            </div>

            {filtered.length === 0 ? (
              <p className="py-6 text-center text-xs text-[var(--ink-soft)]">
                No anomalies detected for the selected filter.
              </p>
            ) : (
              <div className="mt-2 divide-y divide-[var(--line)] max-h-80 overflow-y-auto">
                {filtered.map((anomaly) => (
                  <div key={anomaly.id} className="py-3 text-xs">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
                            anomaly.severity === 'critical'
                              ? 'bg-[var(--danger-soft)] text-[var(--danger)]'
                              : anomaly.severity === 'error'
                              ? 'bg-[var(--warning-soft)] text-[var(--warning)]'
                              : 'bg-[var(--surface-muted)] text-[var(--ink-soft)]'
                          }`}
                        >
                          {anomaly.category}
                        </span>
                        <span className="font-semibold">{anomaly.columnHeader}</span>
                        <span className="text-[var(--ink-soft)]">
                          Row {anomaly.rowNumbers.join(', ')}
                        </span>
                      </div>
                      <span className="text-[10px] font-mono text-[var(--ink-soft)]">
                        Score {(anomaly.score * 100).toFixed(0)}%
                      </span>
                    </div>
                    <p className="mt-1 text-[var(--ink)]">{anomaly.explanation}</p>
                    {anomaly.actionableSuggestion && (
                      <p className="mt-1 text-[var(--signal)]">
                        → Sugestão: {anomaly.actionableSuggestion.label}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
