import type { SourceRule } from '../model/domain'
import { outsideLiterals } from './requestLanguage'

function stableHash(value: string): string {
  let hash = 2166136261

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }

  return (hash >>> 0).toString(36)
}

function cleanRuleText(value: string): string {
  return outsideLiterals(value
    .replace(/&(?:#x20|#32|nbsp);/giu, ' ')
    .replace(/^\s*(?:[-*•]|\d+[.)])\s*/, ''), (fragment) => fragment.replace(/\*\*|__/gu, '').replace(/\s+/gu, ' '))
    .trim()
}

export function parseSourceRules(rulesText: string, disabledRuleIds: string[] = []): SourceRule[] {
  const normalized = rulesText.replace(/\r\n?/g, '\n').trim()

  if (!normalized) {
    return []
  }

  const lines = normalized.split('\n')
  const titled = lines.some((line) => /^\s*(?:\d+[.)]\s*)?(?:\*\*)?Title\s*[:=-]/iu.test(line))
  if (titled) {
    const blocks: string[] = []
    for (const line of lines) {
      if (/^\s*(?:\d+[.)]\s*)?(?:\*\*)?Title\s*[:=-]/iu.test(line) || !blocks.length) blocks.push(line)
      else blocks[blocks.length - 1] += ` ${line}`
    }
    return blocks.map(cleanRuleText).filter(Boolean).map((sourceText, order) => {
      const id = `rule-${order + 1}-${stableHash(sourceText.toLocaleLowerCase())}`
      return { id, sourceText, enabled: !disabledRuleIds.includes(id), order }
    })
  }
  const listed = lines.some((line) => /^\s*(?:[-*•]\s+|\d+[.)]\s+)/u.test(line))
  const blocks: string[] = []
  let current = ''
  if (listed) {
    for (const line of lines) {
      if (!line.trim() || /^\s*(?:[-*•]\s+|\d+[.)]\s+)/u.test(line)) {
        if (current.trim()) blocks.push(current)
        current = line
      } else current += ` ${line}`
    }
    if (current.trim()) blocks.push(current)
  }
  const paragraphBlocks = normalized.split(/\n\s*\n+/).map(cleanRuleText).filter(Boolean)
  const candidates =
    listed ? blocks.map(cleanRuleText).filter(Boolean) : paragraphBlocks.length > 1
      ? paragraphBlocks
      : normalized
          .split('\n')
          .map(cleanRuleText)
          .filter(Boolean)

  return candidates.map((sourceText, order) => {
    const id = `rule-${order + 1}-${stableHash(sourceText.toLocaleLowerCase())}`

    return {
      id,
      sourceText,
      enabled: !disabledRuleIds.includes(id),
      order
    }
  })
}
