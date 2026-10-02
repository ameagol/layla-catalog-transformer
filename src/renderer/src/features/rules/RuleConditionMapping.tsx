import type { BusinessCheck, RuleConfiguration } from '@core/model/businessRules'
import { parseConditionValues } from './helper'

interface RuleConditionMappingProps {
  check: Extract<BusinessCheck, { kind: 'required' }>
  configuration?: RuleConfiguration
  index: number
  disabled: boolean
  onChange: (update: Partial<RuleConfiguration>) => void
}

export function RuleConditionMapping({ check, configuration, index, disabled, onChange }: RuleConditionMappingProps) {
  return <div className="mt-4 space-y-3 rounded-lg border border-[var(--line)] p-3">
    <p className="text-xs text-[var(--ink-soft)]">Specify the values that make this rule apply. These values belong to this rule; no other worksheet is used.</p>
    {check.when?.clauses.map((clause) => <label key={clause.field} className="block text-xs font-semibold text-[var(--ink-soft)]">Applicable {clause.field} values
      <input aria-label={`Condition values for ${clause.field} in rule ${index + 1}`} disabled={disabled} className="mt-1 block w-full rounded-lg border border-[var(--line)] bg-[var(--surface-raised)] p-2 font-normal text-[var(--ink)]" defaultValue={clause.values.join(', ')} placeholder="Enter values separated by commas" onBlur={(event) => onChange({ conditionValues: { ...configuration?.conditionValues, [clause.field]: parseConditionValues(event.target.value) } })} />
    </label>)}
  </div>
}
