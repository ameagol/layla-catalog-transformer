import { describe, expect, it } from 'vitest'

import { coverageCandidates, selectCoverageSuggestion } from '../src/core/copilot/coverage'
import { compileRules } from '../src/core/rules/compiler'
import { parseSourceRules } from '../src/core/rules/source'
import { createCustomerProfile } from './fixtures'

describe('coverage review is advisory, not a new violation', () => {
  it('surfaces an unruled column with many empty values using only profile metadata', () => {
    const profile = createCustomerProfile([
      { rowNumber: 2, values: { name: 'A', phone: '123', email: 'a@example.com', cpf: '1' } },
      { rowNumber: 3, values: { name: 'B', phone: '', email: '', cpf: '2' } }
    ])
    const compilation = compileRules(parseSourceRules('Flag customers with a missing email.'), profile, {})
    const candidates = coverageCandidates(profile, compilation)
    expect(candidates.some((item) => item.kind === 'unruled_missing' && item.label.includes('Phone'))).toBe(true)
    expect(candidates.every((item) => !JSON.stringify(item).includes('a@example.com'))).toBe(true)
  })

  it('abstains on an invented label, weak confidence or truncated input', () => {
    const candidates = [{ id: 'missing-column', kind: 'unruled_missing' as const, label: 'Review coverage', evidence: '50% empty' }]
    expect(selectCoverageSuggestion(candidates, 'missing-column', 0.9)).toBe('missing-column')
    expect(selectCoverageSuggestion(candidates, 'invented', 0.99)).toBeNull()
    expect(selectCoverageSuggestion(candidates, 'missing-column', 0.7)).toBeNull()
    expect(selectCoverageSuggestion(candidates, 'missing-column', 0.99, true)).toBeNull()
  })
})
