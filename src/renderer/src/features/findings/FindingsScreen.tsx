import { FileSearch } from 'lucide-react'

import { AnalysisControls } from './AnalysisControls'
import { FINDINGS_COPY } from './constants'
import { FindingResults } from './FindingResults'
import { PageHeader } from '@/shared/components/PageHeader'
import { StateMessage } from '@/shared/components/StateMessage'
import { useAppStore } from '@/stores/useAppStore'

export function FindingsScreen() {
  const analysis = useAppStore((state) => state.analysis)
  const running = useAppStore((state) => state.busyAction === 'running-analysis')

  return (
    <div className="animate-[rise-in_420ms_ease-out_both]">
      <PageHeader {...FINDINGS_COPY} />
      <AnalysisControls />
      {running ? (
        <StateMessage loading title="Analyzing your dataset" description="Findings will appear here when the local analysis finishes." />
      ) : !analysis ? (
        <StateMessage icon={<FileSearch className="size-6" />} title="Ready for your first findings" description="Load a dataset, prepare your rules, then run the analysis here." />
      ) : <FindingResults key={analysis.id} analysis={analysis} />}
    </div>
  )
}
