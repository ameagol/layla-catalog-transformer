import type { RowActionItem } from '@core/findings/rowActions'
import { PRIORITY_LABELS, priorityImpact } from '@core/rules/metadata'

export function RowActionItems({ items }: { items: RowActionItem[] }) {
  return <ul aria-label="Action items for this row" className="space-y-4">
    {items.map((item) => <li key={`${item.ruleId}:${item.actionItem}`}>
      <span className={`inline-block rounded px-2 py-0.5 text-[11px] font-semibold ${priorityImpact(item.priority) === 'large' ? 'bg-[var(--danger-soft)] text-[var(--danger)]' : 'bg-[var(--surface-muted)] text-[var(--ink-soft)]'}`}>{PRIORITY_LABELS[item.priority]} priority</span>
      <p className="mt-1.5 text-xs leading-5">{item.actionItem}</p>
      <details className="mt-1.5 text-[11px] leading-5 text-[var(--ink-soft)]"><summary className="cursor-pointer">Detected issue</summary><p>{item.explanation}</p></details>
    </li>)}
  </ul>
}
