import type {
  CompilationIssue,
  CompilationResult,
  CompiledMatcher,
  CompiledRule,
  FieldBinding,
  NormalizationOperation,
  ResolvedField,
  SourceRule,
  WorksheetProfile
} from '../model/domain'
import { mergeNormalizations } from '../normalization/normalizers'
import { interpretRules } from './interpreter'
import type { RuleInterpretationContext } from '../model/businessRules'
import { compileBusinessPlan } from './businessCompiler'

function resolvedField(binding: FieldBinding): ResolvedField | null {
  if (binding.status !== 'resolved' || !binding.columnKey || !binding.columnHeader) {
    return null
  }

  return {
    columnKey: binding.columnKey,
    columnHeader: binding.columnHeader,
    semanticType: binding.semanticType
  }
}

function issueForBinding(ruleId: string, binding: FieldBinding): CompilationIssue | null {
  if (binding.status === 'resolved') return null

  return {
    ruleId,
    message:
      binding.status === 'ambiguous'
        ? `The field “${binding.token}” matches multiple columns. Confirm the intended mapping.`
        : `Could not identify a column for “${binding.token}”.`,
    code: binding.status === 'ambiguous' ? 'AMBIGUOUS_FIELD' : 'MISSING_FIELD',
    candidates: binding.candidates
  }
}

function mergePolicy(
  policies: Record<string, NormalizationOperation[]>,
  columnKey: string,
  semanticType: FieldBinding['semanticType'],
  operations: NormalizationOperation[]
): void {
  policies[columnKey] = mergeNormalizations(semanticType, policies[columnKey] ?? [], operations)
}

export function compileInterpretations(interpretations: ReturnType<typeof interpretRules>): CompilationResult {
  const normalizationPolicies: Record<string, NormalizationOperation[]> = {}
  const issues: CompilationIssue[] = []

  for (const interpretation of interpretations) {
    if (interpretation.category !== 'normalization' || interpretation.status !== 'valid') continue
    for (const binding of interpretation.fields) {
      if (binding.columnKey) {
        mergePolicy(normalizationPolicies, binding.columnKey, binding.semanticType, interpretation.normalizations)
      }
    }

  }

  const compiledRules: CompiledRule[] = interpretations.map((interpretation) => {
    if (interpretation.status === 'unsupported') {
      issues.push({
        ruleId: interpretation.id,
        message: interpretation.warnings[0] ?? 'The rule uses an unsupported operation.',
        code: 'UNSUPPORTED_RULE'
      })
      return {
        id: interpretation.id,
        sourceText: interpretation.sourceText,
        category: interpretation.category,
        severity: interpretation.severity,
        interpretation,
        plan: null
      }
    }

    for (const binding of interpretation.fields) {
      if (interpretation.businessCheck?.kind === 'columns_exist' && interpretation.status === 'valid' && binding.status === 'missing') continue
      const issue = issueForBinding(interpretation.id, binding)
      if (issue) issues.push(issue)
    }

    if (interpretation.status !== 'valid' || interpretation.category === 'normalization') {
      if (interpretation.status === 'needs_configuration') {
        issues.push({ ruleId: interpretation.id, code: 'INVALID_RULE', message: interpretation.warnings.join(' ') || 'Complete the rule configuration.' })
      }
      return {
        id: interpretation.id,
        sourceText: interpretation.sourceText,
        category: interpretation.category,
        severity: interpretation.severity,
        interpretation,
        plan: null
      }
    }

    const fields = interpretation.fields.map(resolvedField).filter((field): field is ResolvedField => Boolean(field))
    let plan: CompiledRule['plan'] = null

    if (interpretation.businessCheck) {
      try {
        plan = compileBusinessPlan(interpretation)
      } catch (error) {
        issues.push({ ruleId: interpretation.id, code: 'INVALID_RULE', message: error instanceof Error ? error.message : 'Invalid business rule configuration.' })
      }
    } else if (interpretation.category === 'duplicate' || interpretation.category === 'similarity') {
      const matchers: CompiledMatcher[] = fields.map((field) => ({
        field,
        normalizations: mergeNormalizations(
          field.semanticType,
          normalizationPolicies[field.columnKey] ?? [],
          interpretation.normalizations
        ),
        comparison: interpretation.category === 'similarity' && field.semanticType === 'name' ? 'similarity' : 'equals',
        similarity:
          interpretation.category === 'similarity' && field.semanticType === 'name'
            ? interpretation.similarity
            : undefined
      }))
      plan = { kind: 'duplicate', matchers, logic: interpretation.logic }
    } else if (interpretation.category === 'validation' && fields[0] && interpretation.validator) {
      plan = {
        kind: 'validation',
        field: fields[0],
        validator: interpretation.validator,
        normalizations: mergeNormalizations(
          fields[0].semanticType,
          normalizationPolicies[fields[0].columnKey] ?? [],
          interpretation.normalizations
        )
      }
    } else if (interpretation.category === 'missing' && fields[0]) {
      plan = { kind: 'missing', field: fields[0] }
    } else if (interpretation.category === 'uniqueness' && fields[0]) {
      plan = {
        kind: 'uniqueness',
        field: fields[0],
        normalizations: mergeNormalizations(
          fields[0].semanticType,
          normalizationPolicies[fields[0].columnKey] ?? [],
          interpretation.normalizations
        )
      }
    } else if (interpretation.category === 'consistency' && fields[0] && fields[1]) {
      plan = {
        kind: 'consistency',
        keyField: fields[0],
        dependentField: fields[1],
        keyNormalizations: mergeNormalizations(fields[0].semanticType, normalizationPolicies[fields[0].columnKey] ?? []),
        dependentNormalizations: mergeNormalizations(
          fields[1].semanticType,
          normalizationPolicies[fields[1].columnKey] ?? []
        )
      }
    }

    if (!plan) {
      issues.push({
        ruleId: interpretation.id,
        message: 'The rule was understood but could not produce a complete execution plan.',
        code: 'INVALID_RULE'
      })
    }

    return {
      id: interpretation.id,
      sourceText: interpretation.sourceText,
      category: interpretation.category,
      severity: interpretation.severity,
      interpretation,
      plan
    }
  })

  return {
    interpretations,
    compiledRules,
    normalizationPolicies,
    issues,
    canRun: compiledRules.some((rule) => rule.plan !== null)
  }
}

export function compileRules(
  rules: SourceRule[],
  profile: WorksheetProfile | undefined,
  columnMappings: Record<string, string> = {},
  context: RuleInterpretationContext = {}
): CompilationResult {
  return compileInterpretations(interpretRules(rules, profile, columnMappings, context))
}
