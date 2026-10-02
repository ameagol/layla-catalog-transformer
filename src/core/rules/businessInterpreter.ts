import type { RuleInterpretationContext } from '../model/businessRules'
import type { RuleCategory, RuleInterpretation, SourceRule, WorksheetProfile } from '../model/domain'
import { businessFields, checkConfigurationWarnings, describeBusinessCheck } from './businessChecks'
import { bindBusinessField } from './businessFields'
import { proposeBusinessCheck } from './businessLanguage'
import { prioritySeverity, ruleDetectionText, ruleMetadata } from './metadata'
import { hasUnrepresentedPredicate } from './predicateLanguage'
import { proposeLocalCheck } from './localRuleLanguage'
import { isUnsafeRequestPolarity, withoutLiterals } from './requestLanguage'

export function interpretBusinessRule(rule: SourceRule, profile: WorksheetProfile | undefined, mappings: Record<string, string>, context: RuleInterpretationContext): RuleInterpretation | null {
  const configuration = context.ruleConfigurations?.[rule.id]
  const check = proposeBusinessCheck(rule.sourceText, configuration, profile)
  if (!check) return null
  const metadata = ruleMetadata(rule.sourceText, configuration)
  const fields = businessFields(check).map((token) => bindBusinessField(token, profile, mappings))
  const warnings = checkConfigurationWarnings(check)
  const unresolved = !profile || fields.some((field) => field.status !== 'resolved' && !(check.kind === 'columns_exist' && field.status === 'missing' && !mappings[field.token]))
  const detection = ruleDetectionText(rule.sourceText)
  if (check.kind === 'format' && /other countries|country-specific|equivalent reference/iu.test(detection)) warnings.push('Specify each country and its format as a separate dataset-only rule. This check does not invent formats for other countries.')
  const negated = /\b(?:unless|except|only if|only when|only for|non[ -]transactional|never\s+(?:flag|find|check)|(?:do not|don't)\s+(?:flag|find|check|validate)|automatically\s+merge|auto-merge)\b/iu.test(withoutLiterals(rule.sourceText))
    || hasUnrepresentedPredicate(detection) && !proposeLocalCheck(detection, profile)
    || isUnsafeRequestPolarity(detection)
    || /\b(?:delete|erase|remove)\b[^.!?]*\b(?:rows?|records?)\b/iu.test(detection.replace(/"[^"]*"/gu, 'FIELD'))
  const status = negated ? 'unsupported' : unresolved ? 'needs_mapping' : warnings.length ? 'needs_configuration' : 'valid'
  if (negated) warnings.unshift('This rule contains an exception or negation that is not represented by the proposed check. Rephrase it explicitly before running.')
  if (unresolved) warnings.push('Confirm each named input field; customer, owner, identifier and condition columns are not interchangeable.')
  const category: RuleCategory = check.kind === 'required' || check.kind === 'columns_exist' ? 'missing'
    : check.kind === 'unique_any' ? 'uniqueness' : check.kind === 'weighted_duplicate' ? 'similarity'
      : check.kind === 'duplicate_fields' ? 'duplicate' : check.kind === 'same_fields' ? 'consistency' : 'validation'
  const description = describeBusinessCheck(check)
  return {
    id: rule.id, sourceText: rule.sourceText, ...metadata, category, status, entity: 'Account',
    purpose: metadata.title ?? description, fields, normalizations: [], logic: 'and',
    comparison: category === 'missing' ? 'required' : category === 'uniqueness' ? 'unique' : category === 'similarity' ? 'similarity' : category === 'consistency' ? 'consistent' : 'validate',
    severity: prioritySeverity(metadata.priority ?? 'medium'), interpretationConfidence: unresolved ? 0.6 : 0.98,
    explanation: description, logicSummary: description, warnings, businessCheck: check
  }
}
