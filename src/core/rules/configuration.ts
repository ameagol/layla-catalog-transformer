import type { RuleConfiguration } from '../model/businessRules'

export function reconnectRuleConfigurations(configurations: Record<string, RuleConfiguration> | undefined, _sameWorkbook: boolean): Record<string, RuleConfiguration> | undefined {
  if (!configurations) return configurations
  return Object.fromEntries(Object.entries(configurations).map(([ruleId, configuration]) => [ruleId, { ...configuration, reference: undefined }]))
}
