export interface RuleRequest {
  text: string
  changed: boolean
  detection: boolean
}

const QUOTED_TEXT = /("[^"]*"|“[^”]*”|`[^`]*`|(?<!\w)'[^'\r\n]*'(?!\w))/gu

export function withoutLiterals(text: string): string {
  return text.replace(QUOTED_TEXT, 'VALUE').replace(/’/gu, "'")
}

export function outsideLiterals(text: string, transform: (fragment: string) => string): string {
  return text.split(QUOTED_TEXT).map((fragment, index) => index % 2 ? fragment : transform(fragment)).join('')
}

export function normalizeRuleRequest(source: string): RuleRequest {
  const original = source.trim().replace(/[.!?]+$/u, '').trim()
  let text = original.replace(/^(?:please\s+)?(?:(?:can|could|would)\s+you\s+|i\s+(?:want|need|would like)\s+(?:you\s+)?to\s+)?(?:please\s+)?/iu, '')
  const command = text.match(/^(check|verify|validate|ensure|confirm|make sure|find|identify|detect|report|flag|look for|search for|scan for|test)\b\s*/iu)?.[1]?.toLowerCase()
  const detection = Boolean(command && /^(find|identify|detect|report|flag|look for|search for|scan for)$/u.test(command))
  if (command) {
    text = text.slice(command.length).trim()
      .replace(/^(?:to see\s+)?(?:whether|that)\s+/iu, '')
      .replace(/^for\s+(?=(?:any\s+)?(?:missing|empty|blank|null|duplicate|duplicated|repeated|invalid|malformed)\b)/iu, '')
      .replace(/^if\s+/iu, 'If ')
  }
  text = outsideLiterals(text, (fragment) => fragment
    .replace(/\b(?:isn['’]t|is not|are not|aren['’]t)\s+(?=(?:empty|blank|null)\b)/giu, 'must not be ')
    .replace(/\b(?:should|needs? to|has to|have to|shall)\s+(?=(?:not\s+)?(?:be|have|contain|exist|match)\b)/giu, 'must ')
    .replace(/\b(?:cannot|can['’]?t|must never)\s+be\s+(?=(?:empty|blank|null)\b)/giu, 'must not be ')
    .replace(/\b(?:must\s+)?(?:has|have|contains?)\s+(?:a\s+)?(?:value|data)\b/giu, 'must have a value')
    .replace(/\b(?:is|are|must be)\s+(?:populated|filled(?:\s+(?:in|out))?|non[ -]?empty|non[ -]?blank|provided)\b/giu, 'must have a value')
    .replace(/\b(?:is|are)\s+(?:not\s+(?:populated|filled(?:\s+(?:in|out))?)|unpopulated|absent)\b/giu, 'is blank')
    .replace(/\bnull\b/giu, 'blank')
    .replace(/\b(?:incorrect|malformed)\b/giu, 'invalid')
    .replace(/\b(?:repeating|repeated|repetition|repetitions)\b/giu, 'duplicated')
    .replace(/\b(?:values|entries|cells|data)\s+(?:in|under|of|for)\s+(?:the\s+)?/giu, '')
    .replace(/\b(?:in|across|throughout)\s+(?:the\s+)?(?:whole\s+|entire\s+)?(?:dataset|worksheet|spreadsheet|table|different rows|rows|records)\s*$/giu, '')
    .replace(/\b(?:for|in)\s+(?:each|every|all)\s+(?:rows?|records?|entries)\s*$/giu, '')
    .replace(/\b(?:the|all|any|each|every)\s+(?=")/giu, ''))
  text = outsideLiterals(text, (fragment) => fragment.replace(/\s+/gu, ' ')).trim()
  if (command && /^If\b/iu.test(text) && !/,|\s+then\s+|\s+(?:and|or)\s+|=|\bequals?\b/iu.test(text.replace(/"[^"]*"/gu, 'FIELD'))) text = text.replace(/^If\s+/iu, '')
  if (detection && !/^(?:If|When|For)\b/iu.test(text) && !/^\b(?:missing|empty|blank|duplicated?|invalid)\b/iu.test(text)) {
    text = text.replace(/^(?:rows|records|entries)\s+(?:where|with|whose|having)\s+/iu, 'If ')
  }
  return { text, changed: text !== original, detection }
}

export function cleanFieldPhrase(text: string): string {
  return outsideLiterals(text, (fragment) => fragment
    .replace(/\b(?:the|all|any|each|every|both|values|value|data|cells|cell|entries|entry|columns?|fields?|headers?|named|called|in|under|of|for)\b/giu, ' '))
    .trim()
}

export function isUnsafeRequestPolarity(text: string): boolean {
  const grammar = withoutLiterals(text).replace(/^(?:please\s+)?(?:(?:can|could|would)\s+you\s+)?(?:please\s+)?/iu, '')
  return /\b(?:must|should|shall|needs? to|has to|have to)\s+(?:be|remain)\s+(?:empty|blank|null)\b/iu.test(grammar)
    || /\b(?:must|should|shall)\s+not\s+(?:exist|have (?:a )?value|be (?:populated|filled|present))\b/iu.test(grammar)
    || /\b(?:do not|don't|never)\s+(?:flag|detect|check|validate|report|find|require|enforce|ensure)\b/iu.test(grammar)
    || /\b(?:columns?|headers?)\b.+\bor\b.+\b(?:exists?|present)\b/iu.test(grammar)
    || /^(?:show|list|return|flag|find|report|detect)\b.*\b(?:not\s+(?:empty|blank|null)|non[ -]?empty|populated|filled)\b/iu.test(grammar)
}
