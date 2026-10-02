import type { WorksheetProfile } from '@core/model/domain'

import { formatPercent, semanticLabel } from './helper'

interface ColumnProfileProps {
  profile: WorksheetProfile
}

export function ColumnProfile({ profile }: ColumnProfileProps) {
  return (
    <div role="region" aria-label="Column profile table" tabIndex={0} className="overflow-x-auto">
      <table className="w-full min-w-[740px] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-[var(--line)] bg-[var(--surface-muted)] text-xs font-semibold text-[var(--ink-soft)]">
            <th scope="col" className="px-5 py-3">Column</th><th scope="col" className="px-4 py-3">Type</th><th scope="col" className="px-4 py-3">Meaning</th><th scope="col" className="px-4 py-3">Missing</th><th scope="col" className="px-4 py-3">Unique</th><th scope="col" className="px-4 py-3">Examples</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--line)]">
          {profile.columns.map((column) => (
            <tr key={column.key} className="align-top transition hover:bg-[var(--surface-muted)]/50">
              <th scope="row" className="px-5 py-4 font-semibold"><span className="mr-2 font-['JetBrains_Mono_Variable'] text-xs font-normal text-[var(--ink-soft)]">{column.index + 1}</span>{column.header}</th>
              <td className="px-4 py-4">{column.dataType}</td>
              <td className="px-4 py-4">{semanticLabel(column.semanticType)}</td>
              <td className="px-4 py-4 font-['JetBrains_Mono_Variable'] text-xs">{formatPercent(column.missingRate)}</td>
              <td className="px-4 py-4 font-['JetBrains_Mono_Variable'] text-xs">{formatPercent(column.uniquenessRatio)}</td>
              <td className="max-w-xs px-4 py-4"><div className="space-y-1">{column.examples.slice(0, 3).map((example) => <p key={example} title={example} className="max-w-60 truncate text-xs text-[var(--ink-soft)]">{example}</p>)}</div></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
