import type { BusinessCheck, RuleConfiguration } from '../model/businessRules'
import type { WorksheetProfile } from '../model/domain'
import { ruleDetectionText } from './metadata'
import { proposeLocalCheck, requiresExternalData } from './localRuleLanguage'

export function proposeBusinessCheck(sourceText: string, configuration?: RuleConfiguration, profile?: WorksheetProfile): BusinessCheck | null {
  const detection = ruleDetectionText(sourceText)
  if (requiresExternalData(detection)) return null
  const local = proposeLocalCheck(detection, profile)
  const legacyWording = !/["`“”]/u.test(detection) && !/^(?:If|When|For)\b/iu.test(detection)
  if (legacyWording && local?.kind === 'required' && !local.when && local.targets.length === 1 && /\b(?:blank|empty|missing|required|mandatory)\b/iu.test(detection) && /^(?:phone|email|email address|names?|customer names?|cpf|cnpj)$/iu.test(local.targets[0]!)) return null
  if (legacyWording && local?.kind === 'format' && local.format === 'email' && !local.when) return null
  if (legacyWording && local?.kind === 'duplicate_fields' && /\bduplicat(?:e|ed|es)\b/iu.test(detection)) return null
  if (local) return local
  const text = detection.toLowerCase().replace(/[–—‑]/gu, '-').replace(/\*\*|__/gu, '')
  if (/duplicat/u.test(text) && /name/u.test(text) && /post(?:al|code)|zip/u.test(text) && /similar|weighted/u.test(text)) {
    const percentage = text.match(/(\d+(?:\.\d+)?)\s*%/u)
    const example = /for example|e\.g\.|agreed threshold/u.test(text)
    return {
      kind: 'weighted_duplicate', exactFields: ['Name', 'Postal code'], weightedFields: ['Name', 'Address', 'Postal code'],
      threshold: configuration?.similarity?.threshold ?? (percentage && !example ? Number(percentage[1]) / 100 : undefined),
      weights: configuration?.similarity?.weights
    }
  }
  if (/duplicat|match exactly/u.test(text) && /name/u.test(text) && /post(?:al|code)|zip/u.test(text) && !/\bif\b|\bwhere\b/u.test(text)) {
    return { kind: 'duplicate_fields', targets: ['Name', 'Postal code'], normalized: /normali[sz]/u.test(text) }
  }
  if (/duplicat|unique|more than one record/u.test(text) && /mdmi\s*bpid|fndg\s*id|salesforce\s*id/u.test(text)) {
    return { kind: 'unique_any', targets: ['MDMi BPID', 'FNDG ID', 'Salesforce ID'].filter((field) => text.includes(field.toLowerCase())) }
  }
  if (/segmentation/u.test(text) && /blank|missing|populated|contain a value/u.test(text)) {
    return { kind: 'required', targets: ['Veg Segmentation Type (SFDC)'], match: 'any', configurableScope: true, when: {
      logic: 'and', clauses: [{ field: 'Account Type', values: configuration?.conditionValues?.['Account Type'] ?? [] }]
    } }
  }
  if (/\bstate\b/u.test(text) && /\bus\b|united states/u.test(text) && /compatible|approved|valid|geographic/u.test(text)) {
    return { kind: 'format', field: 'State', format: 'us_state', when: { logic: 'and', clauses: [{ field: 'Country', values: ['US'] }] } }
  }
  if (/postal|postcode|zip/u.test(text) && /\bus\b|country|countries/u.test(text) && /format|pattern|five[ -]digit/u.test(text)) {
    return { kind: 'format', field: 'Postal code', format: /zip\s*(?:or|\/)\s*zip\+4/u.test(text) ? 'zip_or_zip4' : /zip\+4/u.test(text) ? 'zip4' : 'zip',
      when: { logic: 'and', clauses: [{ field: 'Country', values: ['US'] }] } }
  }
  if (/phone/u.test(text) && /email/u.test(text) && /both|neither/u.test(text) && /blank|contact channel/u.test(text) && /\bactive\b|\btransactional\b/u.test(text)) {
    const clauses = [
      ...(/\bactive\b/u.test(text) ? [{ field: 'Account Status', values: ['Active'] }] : []),
      ...(/\btransactional\b/u.test(text) ? [{ field: 'Account category', values: ['Transactional Account', 'Transactional'] }] : [])
    ]
    return { kind: 'required', targets: ['Phone', 'Email'], match: 'all', when: { logic: /active\s+and\s+transactional/u.test(text) ? 'and' : 'or', clauses } }
  }
  if (/\btransactional\b/u.test(text) && /sfdc veg owner/u.test(text) && /blank|missing|must have/u.test(text)) {
    return { kind: 'required', targets: ['SFDC Veg Owner'], match: 'any', when: {
      logic: 'and', clauses: [{ field: 'Account category', values: ['Transactional Account', 'Transactional'] }]
    } }
  }
  return null
}
