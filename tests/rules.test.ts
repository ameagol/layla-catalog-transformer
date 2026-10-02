import { describe, expect, it } from 'vitest'

import { compileRules } from '../src/core/rules/compiler'
import { parseSourceRules } from '../src/core/rules/source'
import { createCustomerProfile } from './fixtures'

const rows = [
  { rowNumber: 2, values: { name: 'João Silva', phone: '(11) 2030-9090', email: 'joao@example.com', cpf: '529.982.247-25' } },
  { rowNumber: 3, values: { name: 'JOAO SILVA', phone: '11-2030-9090', email: 'JOAO@example.com', cpf: '52998224725' } }
]

describe('natural-language rule compilation', () => {
  it('keeps paragraphs as the natural-language source units', () => {
    const rules = parseSourceRules('First rule.\n\nSecond rule.')
    expect(rules.map((rule) => rule.sourceText)).toEqual(['First rule.', 'Second rule.'])
  })

  it('compiles the first vertical-slice duplicate rule', () => {
    const rules = parseSourceRules('Consider customers duplicates when their name and phone are equal after ignoring accents, capitalization, spaces and phone formatting.')
    const result = compileRules(rules, createCustomerProfile(rows), {})
    expect(result.canRun).toBe(true)
    expect(result.issues).toEqual([])
    expect(result.compiledRules[0]?.plan?.kind).toBe('duplicate')
    if (result.compiledRules[0]?.plan?.kind === 'duplicate') {
      expect(result.compiledRules[0].plan.matchers.map((matcher) => matcher.field.semanticType)).toEqual(['name', 'phone'])
    }
  })

  it('requires confirmation when multiple phone columns are equally plausible', () => {
    const profile = createCustomerProfile(rows)
    profile.columns = [
      ...profile.columns.filter((column) => column.semanticType !== 'phone'),
      { ...profile.columns.find((column) => column.semanticType === 'phone')!, key: 'phone_primary', header: 'Phone Number' },
      { ...profile.columns.find((column) => column.semanticType === 'phone')!, key: 'phone_mobile', header: 'Mobile' }
    ]
    const result = compileRules(parseSourceRules('Phone numbers should be considered equal after removing formatting.'), profile, {})
    expect(result.interpretations[0]?.status).toBe('needs_mapping')
    expect(result.issues[0]?.code).toBe('AMBIGUOUS_FIELD')
  })
})

