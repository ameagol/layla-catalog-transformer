import type { SimilarityAlgorithm } from '../model/domain'

export function levenshteinDistance(left: string, right: string): number {
  if (left === right) {
    return 0
  }

  if (left.length === 0) {
    return right.length
  }

  if (right.length === 0) {
    return left.length
  }

  let previous = Array.from({ length: right.length + 1 }, (_, index) => index)

  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const current = [leftIndex]

    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const insertion = (current[rightIndex - 1] ?? 0) + 1
      const deletion = (previous[rightIndex] ?? 0) + 1
      const substitution = (previous[rightIndex - 1] ?? 0) + (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1)
      current[rightIndex] = Math.min(insertion, deletion, substitution)
    }

    previous = current
  }

  return previous[right.length] ?? 0
}

export function levenshteinSimilarity(left: string, right: string): number {
  const longest = Math.max(left.length, right.length)
  return longest === 0 ? 1 : 1 - levenshteinDistance(left, right) / longest
}

export function jaroWinklerSimilarity(left: string, right: string): number {
  if (left === right) {
    return 1
  }

  if (!left || !right) {
    return 0
  }

  const matchDistance = Math.max(Math.floor(Math.max(left.length, right.length) / 2) - 1, 0)
  const leftMatches = new Array<boolean>(left.length).fill(false)
  const rightMatches = new Array<boolean>(right.length).fill(false)
  let matches = 0

  for (let leftIndex = 0; leftIndex < left.length; leftIndex += 1) {
    const start = Math.max(0, leftIndex - matchDistance)
    const end = Math.min(leftIndex + matchDistance + 1, right.length)

    for (let rightIndex = start; rightIndex < end; rightIndex += 1) {
      if (rightMatches[rightIndex] || left[leftIndex] !== right[rightIndex]) {
        continue
      }

      leftMatches[leftIndex] = true
      rightMatches[rightIndex] = true
      matches += 1
      break
    }
  }

  if (matches === 0) {
    return 0
  }

  const leftMatchedCharacters = [...left].filter((_, index) => leftMatches[index])
  const rightMatchedCharacters = [...right].filter((_, index) => rightMatches[index])
  let transpositions = 0

  for (let index = 0; index < leftMatchedCharacters.length; index += 1) {
    if (leftMatchedCharacters[index] !== rightMatchedCharacters[index]) {
      transpositions += 1
    }
  }

  const jaro =
    (matches / left.length + matches / right.length + (matches - transpositions / 2) / matches) / 3
  let prefixLength = 0

  while (prefixLength < Math.min(4, left.length, right.length) && left[prefixLength] === right[prefixLength]) {
    prefixLength += 1
  }

  return jaro + prefixLength * 0.1 * (1 - jaro)
}

export function tokenJaccardSimilarity(left: string, right: string): number {
  const leftTokens = new Set(left.split(/\s+/u).filter(Boolean))
  const rightTokens = new Set(right.split(/\s+/u).filter(Boolean))

  if (leftTokens.size === 0 && rightTokens.size === 0) {
    return 1
  }

  const intersection = [...leftTokens].filter((token) => rightTokens.has(token)).length
  const union = new Set([...leftTokens, ...rightTokens]).size
  return union === 0 ? 0 : intersection / union
}

export function calculateSimilarity(left: string, right: string, algorithm: SimilarityAlgorithm): number {
  if (algorithm === 'levenshtein') {
    return levenshteinSimilarity(left, right)
  }

  if (algorithm === 'token_jaccard') {
    return tokenJaccardSimilarity(left, right)
  }

  return jaroWinklerSimilarity(left, right)
}

