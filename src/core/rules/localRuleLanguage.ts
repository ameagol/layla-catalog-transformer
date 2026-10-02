import type { BusinessCheck, DatasetFormat, RuleCondition } from '../model/businessRules'
import type { WorksheetProfile } from '../model/domain'
import { FIELD_ALIASES } from './businessFields'
import { proposeValueCheck } from './predicateLanguage'
import { cleanFieldPhrase, normalizeRuleRequest, withoutLiterals } from './requestLanguage'
import { proposeColumnPresence } from './columnPresence'

function escapePattern(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')
}

export function quoteRuleFields(source: string, profile?: WorksheetProfile): string {
  const labels = [...new Set([
    ...(profile?.columns.map((column) => column.header) ?? []),
    ...Object.entries(FIELD_ALIASES).flatMap(([field, aliases]) => [field, ...aliases])
  ])].filter(Boolean).sort((left, right) => right.length - left.length)
  const text = source.replace(/[“”`]/gu, '"').replace(/(?<!\w)'([^'\r\n]+)'(?!\w)/gu, '"$1"')
  const pattern = new RegExp(`"[^"]*"|(?<![\\p{L}\\p{N}_])(?:${labels.map(escapePattern).join('|')})(?![\\p{L}\\p{N}_])`, 'giu')
  return text.replace(pattern, (match) => match.startsWith('"') ? match : `"${match}"`)
}

function splitClauses(text: string): { parts: string[]; joins: string[] } {
  const parts: string[] = []
  const joins: string[] = []
  let start = 0
  for (const match of text.matchAll(/"[^"]*"|\s+(and|or)\s+/giu)) {
    if (!match[1]) continue
    parts.push(text.slice(start, match.index).trim())
    joins.push(match[1].toLowerCase())
    start = match.index! + match[0].length
  }
  parts.push(text.slice(start).trim())
  return { parts, joins }
}

function fieldList(text: string): string[] | null {
  text = cleanFieldPhrase(text)
  const fields = [...text.matchAll(/"([^"]+)"/gu)].map((match) => match[1]!)
  const remainder = text.replace(/"[^"]+"/gu, '').replace(/\b(?:the|both|all|values|value|in|of|fields|field|and|or|either)\b|[\s,]/giu, '')
  return fields.length && !remainder ? [...new Set(fields)] : null
}

function requiredCheck(source: string): Extract<BusinessCheck, { kind: 'required' }> | null {
  const text = source.replace(/^(?:If|When|Flag (?:rows|records) (?:where|when|with))\s+/iu, '').trim()
  const match = text.match(/^(.+?)\s+(?:(?:fields?\s+)?(?:is|are|be)\s+)?(blank|empty|missing|required|mandatory|must not be (?:blank|empty)|cannot be (?:blank|empty)|can['’]?t be (?:blank|empty)|must (?:have|contain) (?:a )?value|must exist|exists?|does not exists?)$/iu)
  if (match) {
    const targets = fieldList(match[1]!)
    if (targets) {
      const subject = withoutLiterals(match[1]!)
      const alternative = /\bor\b/iu.test(subject)
      const conjunction = /\band\b|\bboth\b/iu.test(subject)
      if (alternative && conjunction) return null
      const detection = /^(?:blank|empty|missing)$/iu.test(match[2]!)
      return { kind: 'required', targets, match: targets.length > 1 && (detection ? !alternative : alternative) ? 'all' : 'any' }
    }
  }
  const clauses = splitClauses(text)
  if (!clauses.joins.length || new Set(clauses.joins).size !== 1) return null
  const checks = clauses.parts.map(requiredCheck)
  if (checks.some((check) => !check || check.targets.length !== 1)) return null
  const assertions = clauses.parts.map((part) => /\b(?:required|mandatory|must|cannot|can['’]?t)\b/iu.test(part.replace(/"[^"]*"/gu, '')))
  if (assertions.some(Boolean) && !assertions.every(Boolean)) return null
  return { kind: 'required', targets: checks.flatMap((check) => check!.targets), match: clauses.joins[0] === 'and' !== assertions.every(Boolean) ? 'all' : 'any' }
}

function condition(source: string): RuleCondition | null {
  const list = source.match(/^"([^"]+)"\s+(?:is\s+)?(?:one of|in)\s+(.+)$/iu)
  if (list) {
    const values = [...list[2]!.matchAll(/"([^"]+)"/gu)].map((match) => match[1]!)
    if (values.length && !list[2]!.replace(/"[^"]+"/gu, '').replace(/\bor\b|[\s,\[\]]/giu, '')) return { logic: 'and', clauses: [{ field: list[1]!, values }] }
    return null
  }
  const split = splitClauses(source)
  if (new Set(split.joins).size > 1) return null
  const clauses: RuleCondition['clauses'] = []
  for (const part of split.parts) {
    const match = part.match(/^(?:the\s+)?"([^"]+)"(?:\s+field)?\s*(?:=|equals?|is(?:\s+equal\s+to)?)\s*(?:"([^"]+)"|([\p{L}\p{N}_ .\/-]+))$/iu)
    if (!match) return null
    const value = (match[2] ?? match[3])!.trim()
    if (!value || !match[2] && /^(?:not\b|blank$|empty$|missing$|required$)/iu.test(value)) return null
    clauses.push({ field: match[1]!, values: [value] })
  }
  return { logic: split.joins[0] === 'or' ? 'or' : 'and', clauses }
}

function formatCheck(text: string): Extract<BusinessCheck, { kind: 'format' }> | null {
  const short = text.match(/^(?:Flag|Find|Check|Detect|Report)\s+(?:(?:rows|records) with\s+)?(?:invalid|malformed)\s+"([^"]+)"(?: values| codes| addresses)?$/iu)
    ?? text.match(/^(?:If\s+|Flag (?:rows|records) where\s+)?"([^"]+)"\s+is invalid$/iu)
  if (short) return formatCheck(`"${short[1]}" must be valid`)
  const match = text.match(/^(?:If\s+|The\s+)?"([^"]+)"(?:\s+field)?\s+(.+)$/iu)
  if (!match) return null
  const description = match[2]!.replace(/"/gu, '').toLowerCase()
  if (!/^(?:must (?:be|have|contain) (?:an? )?valid(?: (?:email(?: address)?|zip(?: code)?))?|(?:is|has|contains) (?:an? )?invalid (?:email(?: address)?|zip(?: code)?)|is not (?:an? )?valid (?:email(?: address)?|zip(?: code)?)|must (?:match|follow) (?:the )?(?:zip|zip\+4|zip or zip\+4|zip \/ zip\+4)(?: (?:format|pattern))?)$/iu.test(description)) return null
  const format: DatasetFormat | undefined = /zip\s*(?:or|\/)\s*zip\+4/iu.test(description) ? 'zip_or_zip4'
    : /zip\+4/iu.test(description) ? 'zip4' : /zip/iu.test(description) ? 'zip'
      : /email/iu.test(description) || /e-?mail/iu.test(match[1]!) ? 'email'
        : /postal|postcode|zip/iu.test(match[1]!) ? 'zip' : undefined
  return format ? { kind: 'format', field: match[1]!, format } : null
}

function scopedCheck(text: string): BusinessCheck | null {
  const prefix = text.match(/^(?:If|When|For)\s+(.+)$/iu)?.[1]
  if (!prefix) return null
  const separators = [...prefix.matchAll(/"[^"]*"|,\s*(?:then\s+)?|\s+then\s+|\s+and\s+/giu)].filter((match) => !match[0].startsWith('"'))
  for (const separator of separators.reverse()) {
    const when = condition(prefix.slice(0, separator.index).trim())
    if (!when) continue
    const body = prefix.slice(separator.index! + separator[0].length).trim()
    const check = requiredCheck(body) ?? proposeValueCheck(body) ?? formatCheck(body)
    if (check?.kind === 'required' || check?.kind === 'value_check' || check?.kind === 'format') return { ...check, when }
  }
  return null
}

export function proposeLocalCheck(source: string, profile?: WorksheetProfile): BusinessCheck | null {
  const quoted = quoteRuleFields(source, profile).trim()
    .replace(/,?\s+flag\s+(?:this|it|a|an)\b.*$/iu, '').replace(/\.$/u, '').trim()
  const { text } = normalizeRuleRequest(quoted)
  const schema = proposeColumnPresence(text)
  if (schema) return schema
  const prefixed = text.match(/^(?:missing|empty|blank|duplicated?|invalid)\b/iu)
  if (prefixed) {
    const subject = text.slice(prefixed[0].length).replace(/^(?:\s+(?:values|entries|cells))?\s+(?:in|for|of|under)\s+/iu, '')
    const targets = fieldList(subject)
    if (targets?.length) {
      if (/missing|empty|blank/iu.test(prefixed[0])) return /\b(?:columns|headers)\b/iu.test(subject.replace(/"[^"]*"/gu, '')) ? { kind: 'columns_exist', targets } : { kind: 'required', targets, match: 'any' }
      if (/duplicat/iu.test(prefixed[0])) return { kind: 'duplicate_fields', targets, normalized: false }
      if (targets.length === 1) return formatCheck(`"${targets[0]}" must be valid`)
    }
  }
  const scoped = scopedCheck(text)
  if (scoped) return scoped
  const predicate = proposeValueCheck(text)
  if (predicate) return predicate
  const required = requiredCheck(text)
  if (required) return required
  const format = formatCheck(text)
  if (format) return format
  const repeated = text.match(/^(.+?)\s+(?:(?:is|are|has|have|contains?)\s+)?(?:duplicates?|duplicated|duplicate values|duplicate entries|must be unique|must not (?:repeat|have duplicates))$/iu)
  if (repeated) {
    const targets = fieldList(repeated[1]!)
    if (targets?.length) return { kind: 'duplicate_fields', targets, normalized: false }
  }
  const equality = text.match(/^(.+?)\s+(?:must\s+)?(?:match(?:es)?|equal(?:s)?)\s+(.+)$/iu)
  if (equality) {
    const left = fieldList(equality[1]!)
    const right = fieldList(equality[2]!)
    if (left?.length === 1 && right?.length === 1) return { kind: 'same_fields', targets: [...left, ...right] }
  }
  const compared = text.replace(/^(?:If|When|Compare)\s+/iu, '').replace(/\s+within (?:the same|each) row$/iu, '')
    .match(/^(.+?)\s+(?:identify different people|map to conflicting people|(?:are|be|contain|have) different(?: values)?|(?:are )?not all (?:equal|the same)|do not match|(?:must )?(?:contain|have) the same values?|must (?:match|be equal|have the same value)|must identify the same person)$/iu)
  const targets = compared ? fieldList(compared[1]!) : null
  if (targets && targets.length >= 2) return { kind: 'same_fields', targets }
  return null
}

export function requiresExternalData(text: string): boolean {
  return /\b(?:owner directory|reference (?:worksheet|sheet|table|data|routing)|routing matrix|approved combination table|lookup table|external (?:file|sheet|data)|against (?:an? |the )?directory)\b/iu.test(withoutLiterals(text))
}
