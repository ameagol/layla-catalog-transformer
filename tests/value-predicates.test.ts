import { describe, expect, it } from 'vitest'

import { matchesValuePredicate } from '../src/core/engine/valuePredicates'
import { compileRules } from '../src/core/rules/compiler'
import { parseSourceRules } from '../src/core/rules/source'
import { businessProfile, referenceDataset } from './business-rule-fixtures'

describe('literal-value predicate safety', () => {
  it('uses literal matching, preserving punctuation and accents rather than executing regex', () => {
    const predicate = { operator: 'contains' as const, value: 'A.B', forbidden: false, caseSensitive: true }
    expect(matchesValuePredicate('prefix A.B suffix', predicate)).toBe(true)
    expect(matchesValuePredicate('prefix AxB suffix', predicate)).toBe(false)
    expect(matchesValuePredicate('CAFÉ', { ...predicate, value: 'café', caseSensitive: false })).toBe(true)
    expect(matchesValuePredicate('cafe', { ...predicate, value: 'café', caseSensitive: false })).toBe(false)
  })
  it('never coerces blank, Boolean, date or hexadecimal inputs into valid numbers', () => {
    const range = { operator: 'number_range' as const, minimum: 0, maximum: 100 }
    for (const value of ['', ' ', null, true, false, new Date('2000-01-01'), '0x10', '12kg']) expect(matchesValuePredicate(value, range)).toBe(false)
    expect(matchesValuePredicate(0, range)).toBe(true)
    expect(matchesValuePredicate(' 100 ', range)).toBe(true)
  })
  it('rejects additional qualifiers on recognized commercial rules rather than dropping them', () => {
    for (const source of [
      'Country and State must be compatible only if Account Status is Active.',
      'Transactional accounts with a missing SFDC Veg Owner must be flagged except for inactive accounts.',
      'Country and State must be approved and State must contain "NY".'
    ]) expect(compileRules(parseSourceRules(source), businessProfile).canRun).toBe(false)
  })
  it('does not mistake an action mentioning an email for another input field', () => {
    const profile = referenceDataset('Input', [{ SKU: 'VEG-1', Email: 'contact@example.test' }]).profile
    const compilation = compileRules(parseSourceRules('"SKU" must start with "VEG-". Priority: High. Action: Route to Customer Service to send an email.'), profile)
    expect(compilation.canRun).toBe(true)
    expect(compilation.interpretations[0]?.fields.map((field) => field.token)).toEqual(['SKU'])
  })
})
