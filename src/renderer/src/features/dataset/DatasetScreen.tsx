import { useState, type DragEvent } from 'react'
import { FileSpreadsheet, LockKeyhole, UploadCloud } from 'lucide-react'

import { ColumnProfile } from './ColumnProfile'
import { AnomalyScannerPanel } from './AnomalyScannerPanel'
import { DATASET_COPY } from './constants'
import { useAppStore } from '@/stores/useAppStore'
import { ActionButton } from '@/shared/components/ActionButton'
import { ErrorBanner } from '@/shared/components/ErrorBanner'
import { PageHeader } from '@/shared/components/PageHeader'
import { Panel } from '@/shared/components/Panel'
import { StateMessage } from '@/shared/components/StateMessage'

export function DatasetScreen() {
  const [dragActive, setDragActive] = useState(false)
  const [dropError, setDropError] = useState<string | null>(null)
  const project = useAppStore((state) => state.currentProject)
  const workbook = useAppStore((state) => state.workbook)
  const busyAction = useAppStore((state) => state.busyAction)
  const anomalyScan = useAppStore((state) => state.anomalyScan)
  const scanAnomalies = useAppStore((state) => state.scanAnomalies)
  const chooseWorkbook = useAppStore((state) => state.chooseWorkbook)
  const inspectDroppedFile = useAppStore((state) => state.inspectDroppedFile)
  const disabled = !project || Boolean(busyAction)
  const opening = busyAction === 'opening-workbook' || busyAction === 'loading-project'

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setDragActive(false)
    if (disabled) return
    if (event.dataTransfer.files.length !== 1) {
      setDropError('Choose one workbook. Each project has one dataset at a time.')
      return
    }
    setDropError(null)
    const file = event.dataTransfer.files[0]
    if (file) void inspectDroppedFile(file)
  }

  return (
    <div className="animate-[rise-in_420ms_ease-out_both]">
      <PageHeader {...DATASET_COPY} />
      <div className="space-y-6">
        <Panel title="Load Data Set" description="One workbook per project. Choosing another file replaces the current dataset." className="overflow-hidden">
          <div className="p-4">
            {dropError && <ErrorBanner message={dropError} onDismiss={() => setDropError(null)} />}
            <div
              className={`flex min-h-52 items-center justify-center rounded-2xl border-2 border-dashed px-6 py-7 text-center transition ${dragActive ? 'border-[var(--signal)] bg-[var(--signal-soft)]' : 'border-[var(--line-strong)] bg-[var(--surface-muted)]'}`}
              onDragEnter={(event) => { event.preventDefault(); if (!disabled) setDragActive(true) }}
              onDragOver={(event) => event.preventDefault()}
              onDragLeave={() => setDragActive(false)}
              onDrop={handleDrop}
            >
              {opening ? (
                <StateMessage loading title="Loading workbook" description="Reading the file and profiling its columns locally." />
              ) : (
                <div className="min-w-0">
                  {workbook ? <FileSpreadsheet className="mx-auto size-8 text-[var(--success)]" /> : <UploadCloud className="mx-auto size-8 text-[var(--signal)]" />}
                  <p className="mt-3 break-words font-['Fraunces_Variable'] text-xl font-semibold">{workbook?.fileName ?? 'Drop an .xlsx workbook here'}</p>
                  <p className="mt-2 text-sm text-[var(--ink-soft)]">{!project ? 'Create or select a project before loading a file.' : workbook ? `${workbook.selectedSheet.name} · Attached to ${project.name}` : 'The first worksheet is loaded. Your file stays on this computer.'}</p>
                  <ActionButton type="button" className="mt-4" tone="primary" disabled={disabled} onClick={() => { setDropError(null); void chooseWorkbook() }}>{workbook ? 'Replace file' : 'Choose file'}</ActionButton>
                </div>
              )}
            </div>
          </div>
          <p className="flex items-center gap-2 border-t border-[var(--line)] px-5 py-3 text-xs text-[var(--ink-soft)]"><LockKeyhole className="size-4 shrink-0 text-[var(--success)]" />Workbook analysis stays local. Source files are never modified.</p>
        </Panel>
        <Panel title="Column profile" description="Review the dataset's columns, inferred types, and source values." className="min-w-0 overflow-hidden">
          {opening ? <StateMessage loading title="Preparing column profile" description="The profile will appear when your workbook is ready." /> : workbook ? <ColumnProfile profile={workbook.selectedSheet} /> : <StateMessage icon={<FileSpreadsheet className="size-6" />} title="No dataset loaded" description="Choose a workbook to see its column profile here." />}
        </Panel>
        {workbook && (
          <AnomalyScannerPanel
            scanResult={anomalyScan}
            scanning={busyAction === 'scanning-anomalies'}
            onScan={() => void scanAnomalies()}
          />
        )}
      </div>
    </div>
  )
}
