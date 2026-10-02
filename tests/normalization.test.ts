import { describe, expect, it } from 'vitest'

import { mergeNormalizations, normalizeBrazilianPhone, normalizeIdentifier, normalizeValue } from '../src/core/normalization/normalizers'

describe('normalization', () => {
  it('normalizes names deterministically', () => {
    expect(
      normalizeValue("  João   D'Ávila  ", ['remove_punctuation'], 'name')
    ).toBe('joao d avila')
  })

  it('canonicalizes Brazilian phone country and formatting prefixes', () => {
    expect(normalizeBrazilianPhone('+55 (11) 2030-9090')).toBe('1120309090')
    expect(normalizeBrazilianPhone('011 99999-8888')).toBe('11999998888')
  })

  it('preserves meaningful leading zeroes in identifiers', () => {
    expect(normalizeIdentifier('001.234-00')).toBe('00123400')
  })

  it('normalizes email case and surrounding spaces', () => {
    expect(normalizeValue('  USER@Example.COM ', [], 'email')).toBe('user@example.com')
  })

  it('merges field defaults and explicit operations in stable order', () => {
    expect(mergeNormalizations('name', ['remove_punctuation', 'lowercase'])).toEqual([
      'unicode',
      'trim',
      'lowercase',
      'remove_accents',
      'normalize_whitespace',
      'remove_punctuation'
    ])
  })
})

