import { useEffect, useMemo, useState } from 'react'
import { ArrowDownRight, ChevronLeft, ChevronRight, FileSearch, RefreshCw } from 'lucide-react'

import { FINDING_ROWS_PAGE_SIZE } from '@core/findings/sourceRows'
import type { FindingReviewGroup } from '@core/model/domain'

import { buildSourceRowView, isWorksheetIssue } from './helper'
import { WorksheetIssueView } from './WorksheetIssueView'
import type { SourceRowsState } from './models'
import { findingsService } from './service'
import { RowDecisionActions } from './RowDecisionActions'
import { RowActionItems } from './RowActionItems'
import { errorMessage } from '@/lib/error'
import { ActionButton } from '@/shared/components/ActionButton'
import { StateMessage } from '@/shared/components/StateMessage'
import { useAppStore } from '@/stores/useAppStore'

interface SourceRowViewerProps {
  analysisId: string
  finding: FindingReviewGroup
}

interface SourceRowsPageProps extends SourceRowViewerProps {
  offset: number
  onPageChange: (offset: number) => void
  onRetry: () => void
}

export function SourceRowViewer({ analysisId, finding }: SourceRowViewerProps) {
  const [offset, setOffset] = useState(0)
  const [attempt, setAttempt] = useState(0)

  return (
    <section aria-label="Source row review" className="min-w-0 bg-[var(--surface-raised)]">
      {isWorksheetIssue(finding) ? <WorksheetIssueView finding={finding} /> : <SourceRowsPage key={`${analysisId}:${finding.id}:${offset}:${attempt}`} analysisId={analysisId} finding={finding} offset={offset} onPageChange={setOffset} onRetry={() => setAttempt((previous) => previous + 1)} />}
    </section>
  )
}

function SourceRowsPage({ analysisId, finding, offset, onPageChange, onRetry }: SourceRowsPageProps) {
  const rowReview = useAppStore((store) => store.rowReview)
  const decisions = rowReview?.analysisId === analysisId ? rowReview.decisions : undefined
  const [state, setState] = useState<SourceRowsState>({ status: 'loading' })
  const rows = useMemo(() => state.status === 'loaded' ? buildSourceRowView(state.data, finding) : [], [state, finding])

  useEffect(() => {
    let active = true
    void findingsService.getSourceRows(analysisId, finding.id, offset).then(
      (data) => { if (active) setState({ status: 'loaded', data }) },
      (error: unknown) => { if (active) setState({ status: 'error', message: errorMessage(error) }) }
    )
    return () => { active = false }
  }, [analysisId, finding.id, offset])

  if (state.status === 'loading') {
    return <StateMessage loading title="Loading source rows" description="Reading the original values from your local workbook." />
  }

  if (state.status === 'error') {
    return (
      <div role="alert" className="pb-6 text-center">
        <StateMessage icon={<FileSearch className="size-6" />} title="Could not load source rows" description={state.message} />
        <ActionButton type="button" icon={<RefreshCw className="size-4" />} onClick={onRetry}>Try again</ActionButton>
      </div>
    )
  }

  if (!rows.length) {
    return <StateMessage icon={<FileSearch className="size-6" />} title="No source rows available" description="Reload the dataset and run the analysis again to inspect its original values." />
  }

  const source = state.data

  return (
    <>
      <div role="region" aria-label="Scrollable source rows" tabIndex={0} className="max-h-[calc(100vh-26rem)] overflow-auto">
        <table aria-label="Source rows" className="w-full border-collapse text-left text-sm">
          <caption className="sr-only">{finding.explanation} Workbook column numbers are one-based. Affected columns are marked; the first two columns provide row context.</caption>
          <thead className="sticky top-0 z-20">
            <tr>
              <th scope="col" className="sticky left-0 min-w-16 border-b border-r border-[var(--line)] bg-[var(--surface)] px-4 py-3 text-xs font-bold uppercase text-[var(--ink-soft)]">Row</th>
              {source.columns.map((column) => (
                <th key={column.key} scope="col" data-affected={column.affected} className={`min-w-40 border-b border-r border-[var(--line)] px-4 py-3 font-bold uppercase last:border-r-0 ${column.affected ? 'bg-[var(--danger-soft)]' : 'bg-[var(--surface)]'}`}>
                  <span className="mr-2 font-['JetBrains_Mono_Variable'] text-[11px] font-bold text-[var(--ink-soft)]">{column.index + 1}</span>
                  {column.header}{column.affected && <span className="sr-only"> (affected)</span>}
                </th>
              ))}
              <th scope="col" className="min-w-80 border-b border-[var(--line)] bg-[var(--surface)] px-4 py-3 text-xs font-bold uppercase text-[var(--ink-soft)]">Action items</th>
              <th scope="col" className="sticky right-0 z-30 min-w-44 border-b border-l border-[var(--line)] bg-[var(--surface)] px-3 py-3 text-xs font-bold uppercase text-[var(--ink-soft)]">Row decision</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.rowNumber} data-row-number={row.rowNumber} data-decision={decisions?.[row.rowNumber] ?? 'unreviewed'}>
                <th scope="row" className="sticky left-0 z-10 border-b border-r border-[var(--line)] bg-[var(--surface)] px-4 py-4 align-top font-['JetBrains_Mono_Variable'] text-xs font-normal text-[var(--ink-soft)]">{row.rowNumber}</th>
                {row.cells.map((cell) => (
                  <td key={cell.columnKey} data-affected={cell.affected} className={`max-w-72 border-b border-r border-[var(--line)] px-4 py-4 align-top last:border-r-0 ${cell.affected ? 'bg-[var(--danger-soft)]/60' : 'bg-[var(--surface-raised)]'}`}>
                    <p className={`whitespace-pre-wrap break-words font-medium [overflow-wrap:anywhere] ${cell.affected ? 'text-[var(--danger)]' : ''} ${decisions?.[row.rowNumber] === 'delete' ? 'line-through opacity-50' : ''}`}>{cell.original || <span className="font-normal italic">Empty</span>}</p>
                    {cell.normalized !== null && (
                      <div title="Normalized value" className="mt-1.5 flex items-start gap-1.5 text-xs text-[var(--ink-soft)]">
                        <ArrowDownRight aria-hidden="true" className="mt-0.5 size-3 shrink-0" /><span className="sr-only">Normalized: </span><code className="whitespace-pre-wrap break-all font-['JetBrains_Mono_Variable']">{cell.normalized || 'Empty'}</code>
                      </div>
                    )}
                  </td>
                ))}
                <td className="min-w-80 max-w-96 border-b border-[var(--line)] bg-[var(--surface-raised)] px-4 py-4 align-top"><RowActionItems items={row.actions} /></td>
                <td className="sticky right-0 z-10 border-b border-l border-[var(--line)] bg-[var(--surface-raised)] px-3 py-4 align-top"><RowDecisionActions analysisId={analysisId} rowNumber={row.rowNumber} decision={decisions?.[row.rowNumber]} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <footer className="flex items-center justify-between gap-3 px-5 py-3 text-xs text-[var(--ink-soft)]">
        <span>{(source.offset + 1).toLocaleString()}–{(source.offset + rows.length).toLocaleString()} of {source.totalRows.toLocaleString()} rows</span>
        {source.totalRows > FINDING_ROWS_PAGE_SIZE && (
          <div className="flex items-center gap-2">
            <button type="button" aria-label="Previous rows" disabled={offset === 0} onClick={() => onPageChange(Math.max(0, offset - FINDING_ROWS_PAGE_SIZE))} className="rounded border border-[var(--line)] p-1.5 hover:bg-[var(--surface-muted)] disabled:cursor-not-allowed disabled:opacity-40"><ChevronLeft className="size-4" /></button>
            <button type="button" aria-label="Next rows" disabled={offset + rows.length >= source.totalRows} onClick={() => onPageChange(offset + FINDING_ROWS_PAGE_SIZE)} className="rounded border border-[var(--line)] p-1.5 hover:bg-[var(--surface-muted)] disabled:cursor-not-allowed disabled:opacity-40"><ChevronRight className="size-4" /></button>
          </div>
        )}
      </footer>
    </>
  )
}
