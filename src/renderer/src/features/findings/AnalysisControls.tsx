import { Play, RefreshCw } from 'lucide-react'
import { useMemo } from 'react'
import { consolidateFindings } from '@core/findings/consolidate'
import { Link } from 'react-router-dom'

import { getAnalysisReadiness } from './helper'
import { ActionButton } from '@/shared/components/ActionButton'
import { useAppStore } from '@/stores/useAppStore'

export function AnalysisControls() {
  const project = useAppStore((state) => state.currentProject)
  const workbook = useAppStore((state) => state.workbook)
  const compilation = useAppStore((state) => state.compilation)
  const analysis = useAppStore((state) => state.analysis)
  const progress = useAppStore((state) => state.analysisProgress)
  const busyAction = useAppStore((state) => state.busyAction)
  const validateAndSaveRules = useAppStore((state) => state.validateAndSaveRules)
  const runAnalysis = useAppStore((state) => state.runAnalysis)
  const checks = getAnalysisReadiness(project, workbook, compilation)
  const nextStep = checks.find((check) => !check.ready)
  const running = busyAction === 'running-analysis'
  const percent = Math.max(0, Math.min(100, progress?.percent ?? 0))
  const findingCount = useMemo(() => consolidateFindings(analysis?.findings ?? []).length, [analysis])

  return (
    <section aria-label="Analysis controls" className="mb-5 overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--surface)]">
      <div className="flex flex-wrap items-center gap-4 px-5 py-4">
        <div className="min-w-0 flex-1">
          <p role="status" className="text-sm font-semibold">
            {running ? progress?.message ?? 'Starting analysis…' : nextStep ? (
              <Link to={nextStep.path} className="text-[var(--ink)] underline decoration-[var(--line-strong)] underline-offset-4 hover:decoration-[var(--ink)]">{nextStep.detail}</Link>
            ) : analysis ? (
              <>{analysis.rowsAnalyzed.toLocaleString()} rows · {analysis.rulesExecuted} rules · {findingCount.toLocaleString()} findings <span className="font-normal text-[var(--ink-soft)]">· {analysis.durationMs.toLocaleString()} ms</span></>
            ) : 'Ready to analyze'}
          </p>
          {workbook && <p className="mt-1 truncate text-xs text-[var(--ink-soft)]" title={workbook.fileName}>{workbook.fileName} · {workbook.selectedSheet.name}</p>}
        </div>
        {project?.rulesText.trim() && !compilation?.canRun && (
          <ActionButton type="button" icon={<RefreshCw className="size-4" />} disabled={Boolean(busyAction)} onClick={() => void validateAndSaveRules()}>
            {busyAction === 'validating-rules' ? 'Validating…' : 'Validate and Save'}
          </ActionButton>
        )}
        <ActionButton type="button" tone="primary" icon={<Play className="size-4 fill-current" />} disabled={Boolean(nextStep) || Boolean(busyAction)} onClick={() => void runAnalysis()}>
          {running ? 'Analyzing…' : analysis ? 'Run again' : 'Run analysis'}
        </ActionButton>
      </div>
      {running && (
        <div role="progressbar" aria-label="Analysis progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} className="h-1 overflow-hidden bg-[var(--surface-muted)]">
          <div className="h-full bg-[var(--success)] transition-all duration-300" style={{ width: `${percent}%` }} />
        </div>
      )}
    </section>
  )
}
