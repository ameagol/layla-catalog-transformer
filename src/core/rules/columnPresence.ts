import type { BusinessCheck } from '../model/businessRules'

function columnNames(subject: string): string[] | null {
  const parts: string[] = []
  let start = 0
  for (const match of subject.matchAll(/"[^"]*"|[,;]|\s+and\s+/gu)) {
    if (match[0].startsWith('"')) continue
    parts.push(subject.slice(start, match.index))
    start = match.index! + match[0].length
  }
  parts.push(subject.slice(start))
  const names = parts.map((part) => {
    const field = part.trim()
    .replace(/^(?:and\s+)?(?:the\s+|a\s+|these\s+)?(?:(?:columns?|fields?|headers?)\s+)?(?:(?:named|called)\s+)?/iu, '')
    .replace(/\s+(?:columns?|fields?|headers?)$/iu, '')
    .trim()
    const quoted = field.match(/^"([^"]+)"$/u)
    if (quoted) return quoted[1]!
    if (/\b(?:must|should|exists?|not|if|then|empty|blank|missing|invalid)\b/iu.test(field)) return ''
    return field.replace(/"/gu, '').trim()
  })
  if (!names.length || names.some((name) => !name || name.length > 160)) return null
  return [...new Set(names)]
}

export function proposeColumnPresence(source: string): Extract<BusinessCheck, { kind: 'columns_exist' }> | null {
  const text = source.replace(/^(?:If|When)\s+/iu, '').trim()
  const assertion = text.match(/^(.+?)\s+(?:must\s+)?(?:exist|exists|be present|be included|be available|is present|are present|is missing|are missing|does not exist|do not exist)(?:\s+in\s+(?:the\s+)?(?:worksheet|dataset|spreadsheet|headers))?$/iu)
  const missing = text.match(/^missing\s+((?:(?:the|a)\s+)?(?:columns?|headers?|fields?)\s+.+)$/iu)
  const containing = text.match(/^(?:(?:the\s+)?(?:worksheet|dataset|spreadsheet)\s+)?(?:must\s+)?(?:has|have|contains?|includes?)\s+((?:(?:the|a|these)\s+)?(?:columns?|headers?|fields?)\s+.+)$/iu)
  const subject = assertion?.[1] ?? missing?.[1] ?? containing?.[1]
  if (!subject || !/\b(?:columns?|headers?|fields?)\b/iu.test(subject.replace(/"[^"]*"/gu, ''))) return null
  const targets = columnNames(subject)
  return targets?.length ? { kind: 'columns_exist', targets } : null
}
