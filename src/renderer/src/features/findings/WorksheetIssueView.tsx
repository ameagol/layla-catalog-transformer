import type { FindingReviewGroup } from '@core/model/domain'
import { PRIORITY_LABELS, impactPriority } from '@core/rules/metadata'

export function WorksheetIssueView({ finding }: { finding: FindingReviewGroup }) {
  return <section aria-label="Worksheet issue" className="space-y-5 p-6">
    <div>
      <h2 className="text-lg font-semibold">Missing worksheet column</h2>
      <p className="mt-2 text-sm leading-6 text-[var(--ink-soft)]">This is a header issue, not an empty cell. Add or correct the column, then reload the dataset and run the checks again.</p>
    </div>
    {finding.findings.map((issue) => <article key={issue.id} className="rounded-xl border border-[var(--danger)]/25 bg-[var(--danger-soft)]/40 p-5">
      <p className="font-semibold text-[var(--danger)]">{issue.fields.join(', ')}</p>
      <p className="mt-2 text-sm leading-6">{issue.explanation}</p>
      <p className="mt-3 text-xs font-semibold text-[var(--ink-soft)]">{PRIORITY_LABELS[issue.priority ?? impactPriority(issue.impactLevel ?? 'medium')]} priority</p>
      <h3 className="mt-4 text-xs font-semibold uppercase tracking-wide">Action item</h3>
      <p className="mt-1 text-sm leading-6">{issue.suggestedAction}</p>
    </article>)}
    <p className="text-xs leading-5 text-[var(--ink-soft)]">There is no source row to accept or exclude. Download Excel includes this finding in the Worksheet issues sheet.</p>
  </section>
}
