import type { BusinessCheck } from '../model/businessRules'

export function proposeValueCheck(source: string): BusinessCheck | null {
  const text = source.trim().replace(/[“”`]/gu, '"').replace(/\.$/u, '')
  const required = text.match(/^(?:The )?"([^"]+)"(?: field)? (?:is required|is mandatory|must not be (?:blank|empty)|cannot be (?:blank|empty)|must have a value)$/iu)
    ?? text.match(/^Flag (?:rows|records) (?:where|with) "([^"]+)" (?:is )?(?:blank|empty|missing)$/iu)
  if (required) return { kind: 'required', targets: [required[1]!], match: 'any' }
  const conditional = text.match(/^If "([^"]+)" (?:is|equals) "([^"]+)", (?:then )?"([^"]+)" (?:is required|must not be blank|must have a value)$/iu)
  if (conditional) return { kind: 'required', targets: [conditional[3]!], match: 'any', when: { logic: 'and', clauses: [{ field: conditional[1]!, values: [conditional[2]!] }] } }
  const both = text.match(/^Flag (?:rows|records) (?:where|when) both "([^"]+)" and "([^"]+)" are (?:blank|empty|missing)$/iu)
  if (both) return { kind: 'required', targets: [both[1]!, both[2]!], match: 'all' }
  const detectedLiteral = text.match(/^(?:If|Flag (?:rows|records) (?:where|when)) "([^"]+)" (does not )?(contains?|starts? with|ends? with) "([^"]+)"(?:,? (case-insensitive|ignoring case))?$/iu)
  if (detectedLiteral && detectedLiteral[4]!.length <= 256) return { kind: 'value_check', field: detectedLiteral[1]!, predicate: {
    operator: /^contain/iu.test(detectedLiteral[3]!) ? 'contains' : /^start/iu.test(detectedLiteral[3]!) ? 'starts_with' : 'ends_with',
    value: detectedLiteral[4]!, forbidden: !detectedLiteral[2], caseSensitive: !detectedLiteral[5]
  } }
  const unique = text.match(/^(?:The )?"([^"]+)"(?: field)? must be unique(?: across (?:rows|records))?$/iu)
  if (unique) return { kind: 'unique_any', targets: [unique[1]!] }
  const literal = text.match(/^(?:The )?"([^"]+)"(?: field)? must (not )?(contain|start with|end with) "([^"]+)"(?:,? (case-insensitive|ignoring case))?$/iu)
  if (literal && literal[4]!.length <= 256) {
    return { kind: 'value_check', field: literal[1]!, predicate: {
      operator: literal[3]!.toLowerCase() === 'contain' ? 'contains' : literal[3]!.toLowerCase() === 'start with' ? 'starts_with' : 'ends_with',
      value: literal[4]!, forbidden: Boolean(literal[2]), caseSensitive: !literal[5]
    } }
  }
  const allowed = text.match(/^(?:The )?"([^"]+)"(?: field)? must be one of (.+?)(?:,? (case-insensitive|ignoring case))?$/iu)
  if (allowed) {
    const values = [...allowed[2]!.matchAll(/"([^"]+)"/gu)].map((match) => match[1]!)
    const residue = allowed[2]!.replace(/"[^"]+"/gu, '').replace(/\bor\b|[\s,]/giu, '')
    if (values.length && values.length <= 100 && !residue) return { kind: 'value_check', field: allowed[1]!, predicate: { operator: 'one_of', values, caseSensitive: !allowed[3] } }
  }
  const numeric = text.match(/^(?:The )?"([^"]+)"(?: field)? must be between ([+-]?\d+(?:\.\d+)?) and ([+-]?\d+(?:\.\d+)?)(?: inclusive)?$/iu)
  if (numeric) {
    const minimum = Number(numeric[2])
    const maximum = Number(numeric[3])
    if (Number.isFinite(minimum) && Number.isFinite(maximum) && minimum <= maximum) return { kind: 'value_check', field: numeric[1]!, predicate: { operator: 'number_range', minimum, maximum } }
  }
  return null
}

export function hasUnrepresentedPredicate(text: string): boolean {
  return /\b(?:contain|contains|include|includes|start with|starts with|end with|ends with)\s+["'`“]|\b(?:prefix|suffix|regex|regular expression|one of|between|greater than|less than)\b|\b(?:date|dates)\b.+\b(?:before|after)\b/iu.test(text)
}
