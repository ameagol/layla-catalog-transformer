import type { BusinessCheck, RuleConfiguration } from '@core/model/businessRules'

import { equalSimilarityWeights, percentValue } from './helper'

interface SimilarityRuleMappingProps {
  check: Extract<BusinessCheck, { kind: 'weighted_duplicate' }>
  configuration?: RuleConfiguration
  index: number
  disabled: boolean
  onChange: (update: Partial<RuleConfiguration>) => void
}

export function SimilarityRuleMapping({ check, configuration, index, disabled, onChange }: SimilarityRuleMappingProps) {
  const similarity = configuration?.similarity ?? { threshold: check.threshold ?? 0, weights: check.weights ?? {} }
  return (
    <fieldset className="mt-4 rounded-lg border border-[var(--line)] bg-[var(--surface-muted)] p-3 text-xs">
      <legend className="px-1 font-semibold">Approved similarity policy</legend>
      <p className="mb-3 leading-5 text-[var(--ink-soft)]">Example thresholds and unspecified weights are not assumed. Confirm both to enable weighted matching.</p>
      <div className="grid grid-cols-2 gap-3">
        <label className="font-semibold text-[var(--ink-soft)]">Threshold (%)<input aria-label={`Similarity threshold for rule ${index + 1}`} type="number" min="0" max="100" step="any" disabled={disabled} className="mt-1 block w-full rounded-lg border border-[var(--line)] bg-[var(--surface-raised)] p-2 font-normal text-[var(--ink)]" value={similarity.threshold ? Number((similarity.threshold * 100).toFixed(6)) : ''} onChange={(event) => onChange({ similarity: { ...similarity, threshold: percentValue(event.target.value) } })} /></label>
        {check.weightedFields.map((field) => <label key={field} className="font-semibold text-[var(--ink-soft)]">{field} weight (%)<input aria-label={`${field} weight for rule ${index + 1}`} type="number" min="0" max="100" step="any" disabled={disabled} className="mt-1 block w-full rounded-lg border border-[var(--line)] bg-[var(--surface-raised)] p-2 font-normal text-[var(--ink)]" value={similarity.weights[field] ? Number((similarity.weights[field]! * 100).toFixed(6)) : ''} onChange={(event) => onChange({ similarity: { ...similarity, weights: { ...similarity.weights, [field]: percentValue(event.target.value) } } })} /></label>)}
      </div>
      <button type="button" disabled={disabled} className="mt-3 font-semibold underline underline-offset-4 disabled:opacity-45" onClick={() => onChange({ similarity: { threshold: 0.9, weights: equalSimilarityWeights(check.weightedFields) } })}>Confirm 90% with equal weights</button>
    </fieldset>
  )
}
