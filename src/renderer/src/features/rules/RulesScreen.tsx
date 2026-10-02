import { Braces, FilePenLine, WandSparkles } from 'lucide-react'
import { useState } from 'react'

import { parseSourceRules } from '@core/rules/source'

import { RULE_EXAMPLES, RULES_COPY } from './constants'
import { RuleInterpretation } from './RuleInterpretation'
import { RulesAnomalySuggestions } from './RulesAnomalySuggestions'
import { useAppStore } from '@/stores/useAppStore'
import { ActionButton } from '@/shared/components/ActionButton'
import { PageHeader } from '@/shared/components/PageHeader'
import { Panel } from '@/shared/components/Panel'
import { StateMessage } from '@/shared/components/StateMessage'

export function RulesScreen() {
  const [ruleInputFocused, setRuleInputFocused] = useState(false)
  const project = useAppStore((state) => state.currentProject)
  const workbook = useAppStore((state) => state.workbook)
  const compilation = useAppStore((state) => state.compilation)
  const busyAction = useAppStore((state) => state.busyAction)
  const anomalyScan = useAppStore((state) => state.anomalyScan)
  const projectDirty = useAppStore((state) => state.projectDirty)
  const rulesSaveMessage = useAppStore((state) => state.rulesSaveMessage)
  const updateProjectDraft = useAppStore((state) => state.updateProjectDraft)
  const validateAndSaveRules = useAppStore((state) => state.validateAndSaveRules)
  const toggleRule = useAppStore((state) => state.toggleRule)
  const setColumnMapping = useAppStore((state) => state.setColumnMapping)
  const setRuleConfiguration = useAppStore((state) => state.setRuleConfiguration)
  const validating = busyAction === 'validating-rules' || busyAction === 'interpreting'
  const busy = Boolean(busyAction)

  if (!project) {
    return <StateMessage icon={<FilePenLine className="size-6" />} title="Create a project first" description="Rules belong to a project and its connected workbook." />
  }

  const sourceRules = parseSourceRules(project.rulesText, project.disabledRuleIds)

  return (
    <div className="animate-[rise-in_420ms_ease-out_both]">
      <PageHeader {...RULES_COPY} actions={<ActionButton type="button" tone="primary" icon={<WandSparkles className="size-4" />} disabled={busy} onClick={() => void validateAndSaveRules()}>{validating ? 'Validating…' : 'Validate and Save'}</ActionButton>} />
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-10 items-stretch">
          <div className="flex flex-col lg:col-span-7">
            <Panel
              className="flex h-[560px] flex-col overflow-hidden"
              title="Natural-language rules"
              description="Write one rule per paragraph, or use Title, Rule, Flag and Action."
            >
              <div className="flex min-h-0 flex-1 flex-col p-5">
                <textarea
                  aria-label="Natural-language rules"
                  disabled={busy}
                  className="min-h-0 flex-1 w-full resize-none rounded-xl border border-[var(--line)] bg-[var(--surface-raised)] px-4 py-3 font-['JetBrains_Mono_Variable'] text-[13px] leading-7 outline-none transition placeholder:font-light placeholder:text-[var(--ink-soft)] placeholder:opacity-40 focus:border-[var(--aqua)] focus:placeholder:opacity-0"
                  placeholder={ruleInputFocused ? '' : RULE_EXAMPLES.join('\n')}
                  value={project.rulesText}
                  onFocus={() => setRuleInputFocused(true)}
                  onBlur={() => setRuleInputFocused(false)}
                  onChange={(event) => updateProjectDraft({ rulesText: event.target.value })}
                />
                <div className="mt-3 flex shrink-0 items-center justify-between gap-4 text-xs text-[var(--ink-soft)]">
                  <p role="status" className={rulesSaveMessage ? 'text-[var(--success)]' : ''}>{rulesSaveMessage ?? (projectDirty ? 'Unsaved changes' : 'Your rule source is saved locally.')}</p>
                  <span>{sourceRules.length} rules</span>
                </div>
                {sourceRules.length > 0 && (
                  <details className="mt-3 shrink-0 border-t border-[var(--line)] pt-2 text-xs">
                    <summary className="cursor-pointer font-semibold text-[var(--ink-soft)]">Enabled rules</summary>
                    <div className="mt-2 max-h-24 overflow-y-auto space-y-2">
                      {sourceRules.map((rule) => <label key={rule.id} className="flex items-start gap-2 leading-5"><input type="checkbox" checked={rule.enabled} disabled={busy} className="mt-1 accent-[var(--ink)]" onChange={() => toggleRule(rule.id)} /><span className={rule.enabled ? '' : 'text-[var(--ink-soft)] line-through'}>{rule.sourceText}</span></label>)}
                    </div>
                  </details>
                )}
              </div>
            </Panel>
          </div>
          <div className="flex flex-col lg:col-span-3">
            <RulesAnomalySuggestions
              anomalyScan={anomalyScan}
              scanning={busyAction === 'scanning-anomalies'}
            />
          </div>
        </div>
        <Panel title="Rule mapping" description="Review the interpreted intent, input fields, priority and recommended action. Checks use only the uploaded dataset; unresolved or uncertain rules stay blocked.">
          {validating ? <StateMessage loading title="Validating with Laya AI" description="Loading the verified model and reviewing every enabled rule. Uncertain rules will not be saved or run." /> : !compilation ? (
            <StateMessage icon={<WandSparkles className="size-6" />} title="Ready to validate" description="Use Validate and Save to generate the interpretation and save your rules." />
          ) : compilation.interpretations.length === 0 ? (
            <StateMessage icon={<Braces className="size-6" />} title="No enabled rules" description="Write or enable a rule, then Validate and Save." />
          ) : (
            <div role="region" aria-label="Scrollable rule mapping" tabIndex={0} className="overflow-x-auto">
              <table aria-label="Rule mapping" className="w-full min-w-[72rem] border-collapse text-left">
                <thead className="bg-[var(--surface-muted)] text-xs uppercase tracking-wide text-[var(--ink-soft)]"><tr><th scope="col" className="px-5 py-3">Rule</th><th scope="col" className="px-5 py-3">Logic / input fields</th><th scope="col" className="px-4 py-3">Priority</th><th scope="col" className="px-5 py-3">Action item</th></tr></thead>
                <tbody>{compilation.interpretations.map((interpretation, index) => <RuleInterpretation key={interpretation.id} interpretation={interpretation} index={index} issues={compilation.issues} workbook={workbook} mappings={project.columnMappings} disabled={busy} impact={project.ruleImpacts[interpretation.id]} configuration={project.ruleConfigurations?.[interpretation.id]} onMapping={setColumnMapping} onConfiguration={setRuleConfiguration} />)}</tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>
    </div>
  )
}
