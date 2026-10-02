import { describe, expect, it } from 'vitest'

import { calculateSimilarity, jaroWinklerSimilarity, levenshteinDistance, tokenJaccardSimilarity } from '../src/core/matching/similarity'

describe('similarity', () => {
  it('calculates Levenshtein distance', () => {
    expect(levenshteinDistance('kitten', 'sitting')).toBe(3)
  })

  it('gives similar names a high Jaro-Winkler score', () => {
    expect(jaroWinklerSimilarity('maria souza', 'maria de souza')).toBeGreaterThan(0.9)
  })

  it('compares token sets deterministically', () => {
    expect(tokenJaccardSimilarity('ana maria costa', 'costa ana maria')).toBe(1)
  })

  it('selects the requested algorithm', () => {
    expect(calculateSimilarity('joao', 'joão', 'levenshtein')).toBeCloseTo(0.75)
  })
})

