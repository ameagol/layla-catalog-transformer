import type { CompilationIssue, ImpactLevel, RuleInterpretation as Interpretation, WorkbookProfile } from '@core/model/domain'
import type { RuleConfiguration, RulePriority } from '@core/model/businessRules'
import { describeNormalizations } from '@core/normalization/normalizers'
import { PRIORITY_LABELS } from '@core/rules/metadata'

import { effectiveRulePriority, ruleLabel, ruleMessages } from './helper'
import { RuleConditionMapping } from './RuleConditionMapping'
import { SimilarityRuleMapping } from './SimilarityRuleMapping'

interface RuleInterpretationProps {
  interpretation: Interpretation
  index: number
  issues: CompilationIssue[]
  workbook: WorkbookProfile | null
  mappings: Record<string, string>
  disabled: boolean
  impact?: ImpactLevel
  configuration?: RuleConfiguration
  onMapping: (field: string, column: string) => void
  onConfiguration: (ruleId: string, update: Partial<RuleConfiguration>) => void
}

export function RuleInterpretation({ interpretation, index, issues, workbook, mappings, disabled, impact, configuration, onMapping, onConfiguration }: RuleInterpretationProps) {
  const label = ruleLabel(interpretation, issues)
  const messages = ruleMessages(interpretation, issues)
  const update = (change: Partial<RuleConfiguration>) => onConfiguration(interpretation.id, change)

  return (
    <tr className="border-t border-[var(--line)] align-top">
      <th scope="row" className="w-1/4 min-w-60 px-5 py-5 text-left font-normal">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--ink-soft)]">Rule {index + 1}</p>
        <p className="mt-2 text-sm font-semibold leading-6">{interpretation.title ?? interpretation.purpose}</p>
        <div className="mt-3">{label ? <span className={`rounded-md border px-2 py-1 text-xs font-semibold ${label.tone === 'duplicate' ? 'border-[var(--signal)]/30 bg-[var(--signal-soft)] text-[var(--badge-orange)]' : 'border-[var(--danger)]/30 bg-[var(--danger-soft)] text-[var(--danger)]'}`}>{interpretation.status === 'needs_configuration' ? 'Needs setup' : label.text}</span> : <span className="text-xs font-semibold text-[var(--success)]">Mapped</span>}</div>
        <details className="mt-4 text-xs leading-5 text-[var(--ink-soft)]"><summary className="cursor-pointer font-semibold">Original wording</summary><p className="mt-2">{interpretation.sourceText}</p></details>
      </th>
      <td className="min-w-96 px-5 py-5">
        <p className="mb-4 text-xs leading-5 text-[var(--ink-soft)]">{interpretation.logicSummary ?? interpretation.explanation}</p>
        <div className="space-y-3">
          {interpretation.fields.map((field) => <label key={`${field.role}:${field.token}`} className="block text-xs font-semibold text-[var(--ink-soft)]">{field.token}
            {workbook ? <select aria-label={`Column for ${field.token} in rule ${index + 1}`} disabled={disabled} className="mt-1 block w-full rounded-lg border border-[var(--line)] bg-[var(--surface-raised)] px-3 py-2 text-sm font-normal text-[var(--ink)] outline-none focus:border-[var(--aqua)]" value={mappings[field.token] ?? (interpretation.businessCheck ? undefined : mappings[field.semanticType]) ?? field.columnKey ?? ''} onChange={(event) => onMapping(field.token, event.target.value)}>
              <option value="" disabled={interpretation.businessCheck?.kind !== 'columns_exist'}>{interpretation.businessCheck?.kind === 'columns_exist' ? 'Use the named header; report it if absent' : 'Choose a column…'}</option>
              {workbook.selectedSheet.columns.map((column) => <option key={column.key} value={column.key}>{column.index + 1} · {column.header}</option>)}
            </select> : <span className="mt-1 block font-normal text-[var(--danger)]">Load a dataset to map this field.</span>}
            {workbook && interpretation.businessCheck?.kind === 'columns_exist' && field.status === 'missing' && !mappings[field.token] && <span className="mt-1 block font-normal text-[var(--danger)]">Not present — will be reported as a worksheet issue.</span>}
          </label>)}
        </div>
        {interpretation.businessCheck?.kind === 'required' && interpretation.businessCheck.configurableScope && <RuleConditionMapping check={interpretation.businessCheck} configuration={configuration} index={index} disabled={disabled} onChange={update} />}
        {interpretation.businessCheck?.kind === 'weighted_duplicate' && <SimilarityRuleMapping check={interpretation.businessCheck} configuration={configuration} index={index} disabled={disabled} onChange={update} />}
        {interpretation.normalizations.length > 0 && <p className="mt-3 text-xs leading-5 text-[var(--ink-soft)]">Normalization: {describeNormalizations(interpretation.normalizations).join(', ')}.</p>}
        {messages.length > 0 && <ul className="mt-3 space-y-1 text-xs leading-5 text-[var(--danger)]">{messages.map((message) => <li key={message}>{message}</li>)}</ul>}
      </td>
      <td className="min-w-40 px-4 py-5">
        <select aria-label={`Priority for rule ${index + 1}`} disabled={disabled} className="w-full rounded-lg border border-[var(--line)] bg-[var(--surface-raised)] px-3 py-2 text-sm font-semibold" value={effectiveRulePriority(interpretation, configuration, impact)} onChange={(event) => update({ priority: event.target.value as RulePriority })}>
          {Object.entries(PRIORITY_LABELS).map(([value, text]) => <option key={value} value={value}>{text}</option>)}
        </select>
        <p className="mt-2 text-[11px] leading-5 text-[var(--ink-soft)]">Inferred from the rule; editable before validation.</p>
      </td>
      <td className="min-w-72 px-5 py-5">
        <textarea aria-label={`Action item for rule ${index + 1}`} rows={5} maxLength={2000} disabled={disabled} className="w-full resize-y rounded-lg border border-[var(--line)] bg-[var(--surface-raised)] p-3 text-sm leading-6 outline-none focus:border-[var(--aqua)]" placeholder="Recommended action and accountable team…" value={configuration?.actionItem ?? interpretation.actionItem ?? ''} onChange={(event) => update({ actionItem: event.target.value })} />
        <p className="mt-2 text-[11px] leading-5 text-[var(--ink-soft)]">Shown on each affected row and included in the reviewed workbook.</p>
      </td>
    </tr>
  )
}
