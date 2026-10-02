import type { QuestionDef } from 'laya-ts'
import type { RuleInterpretation } from '../model/domain'
import { describeBusinessCheck } from './businessChecks'
import { ruleDetectionText } from './metadata'
import { normalizeRuleRequest, withoutLiterals } from './requestLanguage'

interface AtomicApproval {
  question: QuestionDef
  input: string | { source_rule: string; proposed_check: string }
  label?: string
}

function operation(source: string, label: string, description: string): AtomicApproval {
  return { input: source, label, question: { type: 'choice', instructions: 'Which data-quality check is requested?', criteria: {
    [label]: description, needs_review: 'A different operation, unclear request, or a request to change data.'
  } } }
}

function requirement(source: string, description: string): AtomicApproval {
  return { input: { source_rule: source, proposed_check: description }, question: {
    type: 'noul', instructions: 'Does `proposed_check` correctly describe the requirement expressed by `source_rule`?'
  } }
}

export function atomicLayaApproval(interpretation: RuleInterpretation): AtomicApproval | undefined {
  const check = interpretation.businessCheck
  const source = interpretation.sourceText
  if (check?.kind === 'columns_exist') return { input: source, label: 'columns_exist', question: {
    type: 'choice', instructions: 'What does this rule check?', criteria: {
      columns_exist: 'Check that required columns or headers exist; detect missing columns.',
      missing_values: 'Check for missing or empty values inside cells.',
      duplicate_values: 'Find duplicate or repeated field values across rows.',
      needs_review: 'Another operation, unclear request, or a request to change data.'
    }
  } }
  if (check && 'when' in check && check.when) return undefined
  const detection = ruleDetectionText(source)
  if (/^(?:If|When|For)\b/iu.test(detection)) return undefined
  const request = normalizeRuleRequest(detection)
  const grammar = withoutLiterals(detection)
  const assertion = !request.detection && /\b(?:must|should|shall|required|mandatory|populated|provided|filled|not empty|not blank|isn['’]t|aren['’]t|has a value|have a value|has data|have data)\b/iu.test(grammar)
  if (interpretation.category === 'missing' && (!check || check.kind === 'required')) {
    if (assertion) {
      const targets = check?.targets ?? interpretation.fields.map((field) => field.token)
      if (!targets.length) return undefined
      const fields = targets.join(' and ')
      if (check?.match === 'all') return requirement(source, `At least one of ${targets.join(' or ')} must have a value.`)
      const population = grammar.match(/\b(populated|provided|filled(?: in| out)?)\b/iu)?.[1]
      const description = population?.toLowerCase() === 'provided' ? `${fields} must be provided.`
        : population || /\b(?:empty|blank|null|data)\b/iu.test(grammar) ? `${fields} must contain a value and cannot be left blank.` : `${fields} must have a value.`
      return requirement(source, description)
    }
    if (check?.kind === 'required' && check.targets.length === 1) return operation(source, 'missing', 'Find missing, empty, blank or null values in a field.')
  }
  if (check?.kind === 'duplicate_fields' && !check.normalized) return operation(source, 'duplicate', 'Find duplicate or repeated field values across different rows.')
  if (check?.kind === 'unique_any' && check.targets.length === 1) return operation(source, 'uniqueness', 'Check that each value is unique across different records.')
  if (check?.kind === 'same_fields') return operation(source, 'same_fields', 'Compare multiple columns within each row and check that their values match.')
  if (check?.kind === 'format') return operation(source, 'validation', 'Check whether values match a valid format or data type, such as email or ZIP.')
  if (check?.kind === 'value_check' && assertion) {
    const description = describeBusinessCheck(check)
    return requirement(source, /case-sensitive/iu.test(grammar) ? description : description.replace(/ \(case-sensitive\)\.$/u, '.'))
  }
  return undefined
}
