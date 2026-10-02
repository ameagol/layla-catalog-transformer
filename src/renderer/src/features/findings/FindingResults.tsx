import { useMemo, useState } from 'react'
import { CheckCircle2, Download, Filter, Search, ShieldQuestion } from 'lucide-react'

import type { AnalysisResult, FindingConfidence, FindingType, Severity } from '@core/model/domain'
import { consolidateFindings } from '@core/findings/consolidate'
import { summarizeRowReview } from '@core/findings/review'

import { FindingsList } from './FindingsList'
import { filterFindingGroups, findingTypeLabel } from './helper'
import type { FindingFilters } from './models'
import { SourceRowViewer } from './SourceRowViewer'
import { StateMessage } from '@/shared/components/StateMessage'
import { useAppStore } from '@/stores/useAppStore'

interface FindingResultsProps {
  analysis: AnalysisResult
}

export function FindingResults({ analysis }: FindingResultsProps) {
  const busyAction = useAppStore((state) => state.busyAction)
  const downloadReviewedWorkbook = useAppStore((state) => state.downloadReviewedWorkbook)
  const rowReview = useAppStore((state) => state.rowReview)
  const lastExportPath = useAppStore((state) => state.lastExportPath)
  const [filters, setFilters] = useState<FindingFilters>({ search: '', type: 'all', severity: 'all', confidence: 'all' })
  const [showFilters, setShowFilters] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const groups = useMemo(() => consolidateFindings(analysis.findings), [analysis.findings])
  const findings = useMemo(() => filterFindingGroups(groups, filters), [groups, filters])
  const availableTypes = useMemo(() => [...new Set(analysis.findings.map((finding) => finding.type))], [analysis.findings])
  const selected = findings.find((finding) => finding.id === selectedId) ?? findings[0]
  const hasFilters = filters.type !== 'all' || filters.severity !== 'all' || filters.confidence !== 'all'
  const review = useMemo(() => summarizeRowReview(analysis.findings, analysis.rowsAnalyzed, rowReview, analysis.id), [analysis, rowReview])

  return (
    <section aria-label="Finding review" className="overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--surface)]">
      <div className="flex flex-wrap items-center gap-3 border-b border-[var(--line)] px-4 py-3">
        <label className="relative min-w-40 flex-1">
          <span className="sr-only">Search findings</span>
          <Search aria-hidden="true" className="absolute left-0 top-1/2 size-4 -translate-y-1/2 text-[var(--ink-soft)]" />
          <input type="search" className="w-full rounded bg-transparent py-1 pl-7 pr-2 text-sm text-[var(--ink)] placeholder:text-[var(--ink-soft)]" placeholder="Search findings" value={filters.search} onChange={(event) => setFilters({ ...filters, search: event.target.value })} />
        </label>
        <p role="status" className="text-xs tabular-nums text-[var(--ink-soft)]">{findings.length.toLocaleString()} of {groups.length.toLocaleString()}</p>
        <button type="button" aria-expanded={showFilters} aria-controls="finding-filters" onClick={() => setShowFilters(!showFilters)} className={`inline-flex items-center gap-1.5 rounded px-2 py-1 text-xs font-semibold hover:bg-[var(--surface-muted)] ${hasFilters ? 'text-[var(--signal)]' : 'text-[var(--ink-soft)]'}`}>
          <Filter className="size-3.5" />Filters{hasFilters ? ' · active' : ''}
        </button>
        <button type="button" disabled={Boolean(busyAction)} onClick={() => void downloadReviewedWorkbook()} className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--line)] bg-[var(--surface-raised)] px-3 py-2 text-xs font-semibold hover:border-[var(--line-strong)] disabled:cursor-wait disabled:opacity-45">
          <Download className="size-3.5" />{busyAction === 'exporting' ? 'Downloading…' : 'Download Excel'}
        </button>
      </div>
      <div className="space-y-1 border-b border-[var(--line)] bg-[var(--surface-muted)] px-4 py-3 text-xs leading-5 text-[var(--ink-soft)]">
        <p role="status" aria-live="polite"><span className="font-semibold text-[var(--success)]">{review.accepted.toLocaleString()} accepted</span> · {review.excluded.toLocaleString()} excluded · {review.unreviewed.toLocaleString()} awaiting review · {review.clean.toLocaleString()} clean rows</p>
        <p>Download includes clean rows and explicitly accepted findings, with action items and red error cells. Excluded and unreviewed rows stay out. Accepting a row does not clear its issues.</p>
        {lastExportPath && <p className="break-all text-[var(--success)]">Saved: {lastExportPath}</p>}
      </div>
      {analysis.warnings.length > 0 && <aside aria-label="Analysis coverage warnings" className="border-b border-[var(--line)] bg-[var(--signal-soft)] px-4 py-3 text-xs leading-5"><p className="font-semibold">Review coverage warnings</p><ul className="mt-1 space-y-1">{analysis.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul></aside>}
      {showFilters && (
        <div id="finding-filters" className="flex flex-wrap items-end gap-3 border-b border-[var(--line)] px-4 py-3">
          <label className="text-xs font-semibold text-[var(--ink-soft)]">Type
            <select className="mt-1 block rounded-lg border border-[var(--line)] bg-[var(--surface-raised)] px-3 py-2 text-sm text-[var(--ink)]" value={filters.type} onChange={(event) => setFilters({ ...filters, type: event.target.value as FindingType | 'all' })}>
              <option value="all">All types</option>{availableTypes.map((type) => <option key={type} value={type}>{findingTypeLabel(type)}</option>)}
            </select>
          </label>
          <label className="text-xs font-semibold text-[var(--ink-soft)]">Severity
            <select className="mt-1 block rounded-lg border border-[var(--line)] bg-[var(--surface-raised)] px-3 py-2 text-sm text-[var(--ink)]" value={filters.severity} onChange={(event) => setFilters({ ...filters, severity: event.target.value as Severity | 'all' })}>
              <option value="all">All severities</option><option value="critical">Critical</option><option value="error">Error</option><option value="warning">Warning</option><option value="info">Info</option>
            </select>
          </label>
          <label className="text-xs font-semibold text-[var(--ink-soft)]">Confidence
            <select className="mt-1 block rounded-lg border border-[var(--line)] bg-[var(--surface-raised)] px-3 py-2 text-sm text-[var(--ink)]" value={filters.confidence} onChange={(event) => setFilters({ ...filters, confidence: event.target.value as FindingConfidence | 'all' })}>
              <option value="all">All confidence</option><option value="HIGH">High</option><option value="MEDIUM">Medium</option><option value="LOW">Low</option>
            </select>
          </label>
          <button type="button" className="rounded px-2 py-2 text-xs font-semibold text-[var(--ink-soft)] hover:underline" onClick={() => setFilters({ search: '', type: 'all', severity: 'all', confidence: 'all' })}>Clear filters</button>
        </div>
      )}
      {analysis.findings.length === 0 ? (
        <StateMessage icon={<CheckCircle2 className="size-6" />} title="No issues detected" description={`${analysis.rowsAnalyzed.toLocaleString()} rows have no detected deviations. Review any coverage warnings; unchecked values are not verified. You can still download the complete dataset.`} />
      ) : selected ? (
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,4fr)]">
          <FindingsList findings={findings} selectedId={selected.id} onSelect={setSelectedId} />
          <SourceRowViewer key={`${analysis.id}:${selected.id}`} analysisId={analysis.id} finding={selected} />
        </div>
      ) : (
        <div className="pb-6 text-center">
          <StateMessage icon={<ShieldQuestion className="size-6" />} title="No findings match these filters" description="Adjust your search or clear the filters to see all findings." />
          <button type="button" className="rounded text-sm font-semibold underline underline-offset-4" onClick={() => setFilters({ search: '', type: 'all', severity: 'all', confidence: 'all' })}>Clear filters</button>
        </div>
      )}
    </section>
  )
}
