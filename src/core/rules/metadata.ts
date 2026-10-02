import type { RuleConfiguration, RulePriority } from '../model/businessRules'
import type { ImpactLevel, RuleInterpretation, Severity } from '../model/domain'

export const PRIORITY_LABELS: Record<RulePriority, string> = {
  low: 'Low', low_medium: 'Low / Medium', medium: 'Medium', medium_high: 'Medium / High', high: 'High'
}

export function priorityImpact(priority?: RulePriority): ImpactLevel {
  return priority === 'high' || priority === 'medium_high' ? 'large' : priority === 'low' ? 'small' : 'medium'
}

export function impactPriority(impact: ImpactLevel): RulePriority {
  return impact === 'large' ? 'high' : impact === 'small' ? 'low' : 'medium'
}

export function prioritySeverity(priority: RulePriority): Severity {
  return priorityImpact(priority) === 'large' ? 'error' : priority === 'low' ? 'info' : 'warning'
}

export function ruleMetadata(sourceText: string, configuration?: RuleConfiguration): Pick<RuleInterpretation, 'title' | 'priority' | 'actionItem'> {
  const text = sourceText.replace(/&(?:#x20|#32|nbsp);/giu, ' ').replace(/\*\*|__/gu, '').replace(/[–—‑]/gu, '-')
  const priorityText = text.toLowerCase()
  const labeled = priorityText.match(/\b(?:priority|flag)\s*(?::|=|-|is)\s*((?:low|medium)\s*(?:\/|to|or|and)\s*(?:medium|high)|low|medium|high)\b/u)?.[1]
  const priorityValue = labeled ? `${labeled} priority` : priorityText
  const range = priorityValue.match(/\b(low|medium)\s*-?\s*(?:\/|to|or|and)\s*(medium|high)\s*-?\s*priority/u)
  const single = priorityValue.match(/\b(low|medium|high)\s*-?\s*priority/u)
  const priority: RulePriority | undefined = range
    ? labeled ? range[1] === 'low' ? 'low_medium' : 'medium_high' : range[1] as RulePriority
    : single?.[1] as RulePriority | undefined
  const labeledAction = text.match(/\b(?:Action(?: item)?|Recommended action)\s*[:=-]\s*(.+?)(?=\s+(?:Priority|Flag)\s*[:=-]|$)/isu)?.[1]
  const action = labeledAction ?? text.match(/\b(?:Route|Refer|Send|Escalate)\s+(?:[^.!?]*?\s+)?to\s+[^.!?]+(?:[.!?]|$)(?:\s*(?:Recommend|Validate|Confirm|Review)\b[^.!?]+[.!?]?)?/iu)?.[0]
  const title = text.match(/(?:^|\s)Title\s*[:=-]\s*(.+?)(?=\s+Rule\s*[:=-]|$)/isu)?.[1]?.trim()
    ?? (text.split(/\.\s|\.$/u)[0]?.trim() || text)
  return {
    title,
    priority: configuration?.priority ?? priority,
    actionItem: configuration?.actionItem?.trim() || action?.trim()
  }
}

export function ruleDetectionText(sourceText: string): string {
  const text = sourceText.replace(/&(?:#x20|#32|nbsp);/giu, ' ').replace(/\*\*|__/gu, '')
  const labeled = text.match(/(?:^|\s)Rule\s*[:=-]\s*(.+?)(?=\s+(?:Priority|Flag|Action(?: item)?|Recommended action)\s*[:=-]|$)/isu)?.[1]
  const detection = (labeled ?? text)
    .replace(/\s*\b(?:Priority|Flag|Action(?: item)?|Recommended action)\s*[:=-].*$/isu, '')
    .replace(/(?:\s+and)?\s+\b(?:Route|Refer|Send|Escalate)\s+(?:[^.!?]*?\s+)?to\s+.*$/isu, '')
    .trim()
  if (labeled) return detection
  const sentences = detection.split(/\.\s+/u)
  if (sentences.length > 1 && !/^(?:If|When|For|Flag|Find|Check|Validate|Detect|Report)\b/iu.test(sentences[0]!)
    && /^(?:If|When|For|Flag|Find|Check|Validate|Detect|Report|US\b)/iu.test(sentences[1]!)) return sentences.slice(1).join('. ')
  return detection
}
