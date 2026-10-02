import type { RuleInterpretation, RuleInterpretationRequest } from '../model/domain'
import { interpretRules } from './interpreter'

export interface RuleInterpreterProvider {
  readonly id: string
  readonly local: boolean
  interpret(request: RuleInterpretationRequest): Promise<RuleInterpretation[]>
}

export class DeterministicRuleInterpreterProvider implements RuleInterpreterProvider {
  readonly id = 'deterministic'
  readonly local = true

  async interpret(request: RuleInterpretationRequest): Promise<RuleInterpretation[]> {
    return interpretRules(request.rules, request.profile, request.columnMappings)
  }
}

