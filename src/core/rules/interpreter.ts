import type {
  FieldBinding,
  FieldCandidate,
  NormalizationOperation,
  RuleCategory,
  RuleInterpretation,
  SemanticType,
  Severity,
  SourceRule,
  ValidatorKind,
  WorksheetProfile
} from '../model/domain'
import { normalizeFieldLabel } from '../dataset/columnInference'
import type { RuleInterpretationContext } from '../model/businessRules'
import { interpretBusinessRule } from './businessInterpreter'
import { prioritySeverity, ruleDetectionText, ruleMetadata } from './metadata'
import { hasUnrepresentedPredicate } from './predicateLanguage'
import { quoteRuleFields, requiresExternalData } from './localRuleLanguage'
import { isUnsafeRequestPolarity, withoutLiterals } from './requestLanguage'

interface RequestedField {
  token: string
  semanticType: SemanticType
  index: number
}

const FIELD_PATTERNS: Array<{ semanticType: SemanticType; token: string; patterns: RegExp[] }> = [
  { semanticType: 'cpf', token: 'CPF', patterns: [/\bcpf\b/gu] },
  { semanticType: 'cnpj', token: 'CNPJ', patterns: [/\bcnpj\b/gu] },
  {
    semanticType: 'email',
    token: 'email',
    patterns: [/\be ?mails?\b/gu, /\bemail addresses?\b/gu, /\bcorreio eletronico\b/gu]
  },
  {
    semanticType: 'phone',
    token: 'phone',
    patterns: [/\bphones?\b/gu, /\bphone numbers?\b/gu, /\bmobile\b/gu, /\btelefone\b/gu, /\bcelular\b/gu, /\bddd\b/gu]
  },
  {
    semanticType: 'name',
    token: 'name',
    patterns: [/\bfull names?\b/gu, /\bcustomer names?\b/gu, /\bclient names?\b/gu, /\bnames?\b/gu, /\bnome\b/gu]
  },
  {
    semanticType: 'date',
    token: 'date',
    patterns: [/\bbirth dates?\b/gu, /\bbirthdays?\b/gu, /\bdates?\b/gu, /\bdata nascimento\b/gu]
  },
  {
    semanticType: 'identifier',
    token: 'identifier',
    patterns: [
      /\bcustomer identifiers?\b/gu,
      /\bcustomer ids?\b/gu,
      /\bclient ids?\b/gu,
      /\binvoice numbers?\b/gu,
      /\border ids?\b/gu,
      /\baccount numbers?\b/gu,
      /\bidentifiers?\b/gu
    ]
  }
]

function detectCategory(text: string): { category: RuleCategory; confidence: number } | null {
  const valueComparison = text.replace(/\b(different|diferentes)\s+(?:(?:phone|number|name|email|identifier)\s+)?(?:formats?|formatting|capitalization|casing|spacing|punctuation)\b/gu, '')
  if (/\b(same|mesmo)\b.+\b(different|different names|different dates|diferent|diferentes)\b/u.test(valueComparison) || /must not be associated with different|cannot have different/u.test(valueComparison)) {
    return { category: 'consistency', confidence: 0.98 }
  }

  if (/\b(missing|without|empty|blank|required|mandatory)\b|cannot be empty|must have(?!\s+(?:a\s+)?valid\b)/u.test(text)) {
    return { category: 'missing', confidence: 0.95 }
  }

  if (/\b(unique|uniqueness)\b|only one customer|belong to only one/u.test(text)) {
    return { category: 'uniqueness', confidence: 0.96 }
  }

  if (/\b(duplicate|duplicates|duplicated)\b/u.test(text)) {
    return { category: /\bsimilar|similarity|\d{1,3}\s*%/u.test(text) ? 'similarity' : 'duplicate', confidence: 0.99 }
  }

  if (/\b(ignore|ignoring|regardless|case insensitive|case-insensitive|compared|considered equal|treat.+equal|normalize)\b/u.test(text)) {
    return { category: 'normalization', confidence: 0.91 }
  }

  if (/\b(valid|invalid|format|checksum|ddd|numeric|number)\b/u.test(text)) {
    return { category: 'validation', confidence: 0.9 }
  }

  return null
}

function hasConditionalRequirement(text: string): boolean {
  const scopedText = text
    .replace(/\b(?:check|verify|validate|ensure|confirm|test)\s+(?:to see\s+)?(?:if|whether|that)\b/gu, '')
    .replace(/\b(?:check(?:ing)?|look(?:ing)?|search(?:ing)?|scan(?:ning)?|test(?:ing)?)\s+for\b/gu, '')
    .replace(/\bfor\s+(?:each|every|all)\s+(?:rows?|records?|customers?|clients?|entries|items?|orders?|invoices?|products?)\b/gu, '')
  return /\b(for|where|if)\b/u.test(scopedText)
}

function detectEntity(text: string): string {
  if (/\bcustomer|customers|client|clients\b/u.test(text)) return 'Customer'
  if (/\binvoice|invoices\b/u.test(text)) return 'Invoice'
  if (/\border|orders\b/u.test(text)) return 'Order'
  if (/\bproduct|products|item|items\b/u.test(text)) return 'Product'
  return 'Record'
}

function detectSeverity(text: string, category: RuleCategory): Severity {
  if (/\bcritical|blocker\b/u.test(text)) return 'critical'
  if (/\berror|must not|cannot\b/u.test(text)) return 'error'
  if (/\binfo|informational\b/u.test(text)) return 'info'
  return category === 'validation' || category === 'consistency' ? 'error' : 'warning'
}

function extractNormalizations(text: string, fields: RequestedField[]): NormalizationOperation[] {
  const operations = new Set<NormalizationOperation>()

  if (/\b(capitalization|case|case insensitive|case-insensitive|uppercase|lowercase)\b/u.test(text)) {
    operations.add('lowercase')
  }
  if (/\b(accents?|diacritics?)\b/u.test(text)) operations.add('remove_accents')
  if (/\b(spaces?|whitespace|leading|trailing)\b/u.test(text)) {
    operations.add('trim')
    operations.add('normalize_whitespace')
  }
  if (/\bpunctuation\b/u.test(text)) operations.add('remove_punctuation')
  if (/\bdigits? only|numbers? only\b/u.test(text)) operations.add('digits_only')
  if (/\b(formats?|formatting)\b/u.test(text)) {
    if (fields.some((field) => field.semanticType === 'phone')) operations.add('phone_br')
    if (fields.some((field) => ['cpf', 'cnpj', 'identifier'].includes(field.semanticType))) operations.add('identifier')
    if (fields.some((field) => field.semanticType === 'name')) operations.add('remove_punctuation')
  }
  if (fields.some((field) => field.semanticType === 'email')) operations.add('email')

  return [...operations]
}

function extractSimilarity(text: string): RuleInterpretation['similarity'] {
  const thresholdMatch = text.match(/(\d{1,3}(?:\.\d+)?)\s*%/u)
  const threshold = thresholdMatch ? Math.min(1, Math.max(0, Number(thresholdMatch[1]) / 100)) : 0.9
  const algorithm = /levenshtein/u.test(text)
    ? 'levenshtein'
    : /token|word/u.test(text)
      ? 'token_jaccard'
      : 'jaro_winkler'

  return { algorithm, threshold }
}

function detectValidator(text: string, fields: RequestedField[]): ValidatorKind | undefined {
  if (/\bcpf\b/u.test(text)) return 'cpf'
  if (/\bcnpj\b/u.test(text)) return 'cnpj'
  if (/\bemail\b/u.test(text)) return 'email'
  if (/\b(phone|telefone|ddd)\b/u.test(text)) return 'phone_br'
  if (/\bdate|data\b/u.test(text)) return 'date'
  if (/\bnumeric|number\b/u.test(text)) return 'number'
  if (/\brequired|mandatory|must have|cannot be empty\b/u.test(text)) return 'required'
  if (fields.some((field) => field.semanticType === 'identifier') && /\bvalid\b/u.test(text)) return 'required'
  return undefined
}

function findPatternIndex(text: string, patterns: RegExp[]): number {
  const indexes = patterns
    .map((pattern) => {
      pattern.lastIndex = 0
      return pattern.exec(text)?.index ?? -1
    })
    .filter((index) => index >= 0)
  return indexes.length === 0 ? -1 : Math.min(...indexes)
}

function extractRequestedFields(text: string, profile?: WorksheetProfile): RequestedField[] {
  const requested: RequestedField[] = []

  for (const fieldPattern of FIELD_PATTERNS) {
    const index = findPatternIndex(text, fieldPattern.patterns)
    if (index >= 0) {
      requested.push({ token: fieldPattern.token, semanticType: fieldPattern.semanticType, index })
    }
  }

  if (profile) {
    for (const column of profile.columns) {
      const normalizedHeader = normalizeFieldLabel(column.header)
      const index = normalizedHeader.length >= 3 ? text.indexOf(normalizedHeader) : -1
      if (index >= 0 && !requested.some((field) => field.token === column.header || field.index === index)) {
        requested.push({
          token: column.header,
          semanticType: column.semanticType === 'unknown' ? 'text' : column.semanticType,
          index
        })
      }
    }
  }

  const unique = new Map<string, RequestedField>()
  for (const field of requested.sort((left, right) => left.index - right.index)) {
    const key = `${field.semanticType}:${normalizeFieldLabel(field.token)}`
    if (!unique.has(key)) unique.set(key, field)
  }

  return [...unique.values()]
}

function candidateForField(
  requestedField: RequestedField,
  profile: WorksheetProfile,
  columnMappings: Record<string, string>
): FieldBinding {
  const mappingKey = columnMappings[requestedField.token] ?? columnMappings[requestedField.semanticType]
  if (mappingKey) {
    const mappedColumn = profile.columns.find((column) => column.key === mappingKey)
    if (mappedColumn) {
      return {
        token: requestedField.token,
        role: 'target',
        semanticType: requestedField.semanticType,
        status: 'resolved',
        columnKey: mappedColumn.key,
        columnHeader: mappedColumn.header,
        candidates: [
          { columnKey: mappedColumn.key, columnHeader: mappedColumn.header, score: 1, reason: 'Confirmed project mapping.' }
        ]
      }
    }
  }

  const normalizedToken = normalizeFieldLabel(requestedField.token)
  const candidatesByColumn = new Map<string, FieldCandidate>()

  for (const column of profile.columns) {
    const normalizedHeader = normalizeFieldLabel(column.header)
    let score = 0
    let reason = ''

    if (normalizedHeader === normalizedToken) {
      score = 0.99
      reason = 'The rule names this column directly.'
    } else if (normalizedHeader.includes(normalizedToken) || normalizedToken.includes(normalizedHeader)) {
      score = 0.9
      reason = 'The rule field closely matches the column header.'
    }

    const semanticCandidate = column.semanticCandidates.find(
      (candidate) => candidate.semanticType === requestedField.semanticType
    )
    if (semanticCandidate && semanticCandidate.score > score) {
      score = semanticCandidate.score
      reason = semanticCandidate.reasons[0] ?? 'Column semantics match the requested field.'
    }

    if (column.semanticType === requestedField.semanticType && column.semanticConfidence > score) {
      score = column.semanticConfidence
      reason = 'The dataset profile identified this semantic field.'
    }

    if (score >= 0.25) {
      candidatesByColumn.set(column.key, {
        columnKey: column.key,
        columnHeader: column.header,
        score: Number(score.toFixed(3)),
        reason
      })
    }
  }

  const candidates = [...candidatesByColumn.values()].sort((left, right) => right.score - left.score)
  const first = candidates[0]
  const second = candidates[1]
  const resolved = Boolean(first && first.score >= 0.72 && (!second || first.score - second.score >= 0.12))

  return {
    token: requestedField.token,
    role: 'target',
    semanticType: requestedField.semanticType,
    status: resolved ? 'resolved' : candidates.length > 0 ? 'ambiguous' : 'missing',
    columnKey: resolved ? first?.columnKey : undefined,
    columnHeader: resolved ? first?.columnHeader : undefined,
    candidates: candidates.slice(0, 4)
  }
}

function assignRoles(category: RuleCategory, bindings: FieldBinding[]): FieldBinding[] {
  return bindings.map((binding, index) => ({
    ...binding,
    role:
      category === 'duplicate' || category === 'similarity'
        ? 'match'
        : category === 'consistency'
          ? index === 0
            ? 'key'
            : 'dependent'
          : 'target'
  }))
}

function purposeForCategory(category: RuleCategory): string {
  const purposes: Record<RuleCategory, string> = {
    duplicate: 'Exact normalized duplicate detection',
    similarity: 'Deterministic fuzzy duplicate detection',
    normalization: 'Reusable comparison normalization',
    validation: 'Field format validation',
    uniqueness: 'Uniqueness enforcement',
    consistency: 'Cross-record consistency enforcement',
    missing: 'Required-value detection'
  }
  return purposes[category]
}

export function interpretRule(
  rule: SourceRule,
  profile?: WorksheetProfile,
  columnMappings: Record<string, string> = {},
  context: RuleInterpretationContext = {}
): RuleInterpretation {
  const business = interpretBusinessRule(rule, profile, columnMappings, context)
  if (business) return business
  const metadata = ruleMetadata(rule.sourceText, context.ruleConfigurations?.[rule.id])
  const detectionText = ruleDetectionText(rule.sourceText)
  const grammar = withoutLiterals(quoteRuleFields(detectionText, profile))
  const normalizedText = normalizeFieldLabel(detectionText)
  const categoryMatch = detectCategory(normalizedText)

  if (!categoryMatch) {
    return {
      id: rule.id,
      sourceText: rule.sourceText,
      ...metadata,
      category: 'validation',
      status: 'unsupported',
      entity: detectEntity(normalizedText),
      purpose: 'Unsupported rule',
      fields: [],
      normalizations: [],
      logic: 'and',
      comparison: 'validate',
      severity: 'warning',
      interpretationConfidence: 0,
      explanation: 'The deterministic interpreter could not map this sentence to a supported rule primitive.',
      warnings: ['Rephrase the rule using duplicate, required, unique, consistency, similarity, or validation language.']
    }
  }

  const requestedFields = extractRequestedFields(normalizedText, profile)
  const vagueDuplicate =
    (categoryMatch.category === 'duplicate' || categoryMatch.category === 'similarity') && requestedFields.length === 0
  const conditionalMissing =
    categoryMatch.category === 'missing' && hasConditionalRequirement(normalizedText)
  const bindings = assignRoles(
    categoryMatch.category,
    requestedFields.map((field) =>
      profile
        ? candidateForField(field, profile, columnMappings)
        : {
            token: field.token,
            role: 'target' as const,
            semanticType: field.semanticType,
            status: 'missing' as const,
            candidates: []
          }
    )
  )
  const normalizations = extractNormalizations(normalizedText, requestedFields)
  const validator = detectValidator(normalizedText, requestedFields)
  const warnings: string[] = []

  if (vagueDuplicate) warnings.push('Duplicate criteria are not explicit. Name, email, phone, or an identifier must be selected.')
  if (conditionalMissing) warnings.push('Conditional required rules are not yet supported by the deterministic vocabulary.')
  if (bindings.some((binding) => binding.status === 'ambiguous')) warnings.push('One or more fields need a confirmed column mapping.')
  if (bindings.some((binding) => binding.status === 'missing')) warnings.push('One or more required fields could not be found in the selected worksheet.')

  const unrepresentedPredicate = hasUnrepresentedPredicate(detectionText)
  if (unrepresentedPredicate) warnings.push('This text, range or date condition is not represented safely. Use an explicit supported predicate with a quoted column name and literal values.')
  const externalData = requiresExternalData(detectionText)
  if (externalData) warnings.unshift('External-reference validation is not supported. Use fields in the uploaded dataset, built-in formats, or literal values written in the rule.')
  const unsupportedScope = isUnsafeRequestPolarity(detectionText) || /\b(?:unless|except|only if|only when|only for)\b/iu.test(grammar) || categoryMatch.category === 'validation' && /\bif\b/iu.test(grammar.replace(/\b(?:check|verify|validate|ensure|confirm|test)\s+(?:to see\s+)?if\b/giu, ''))
  const unsupportedCommand = /\b(?:do not|don't|never)\s+(?:flag|detect|check|validate|report|find)\b|\b(?:delete|erase|remove)\b[^.!?]*\b(?:rows?|records?)\b|\b(?:automatically\s+merge|auto-merge)\b/iu.test(detectionText.replace(/"[^"]*"/gu, 'FIELD'))
  if (unsupportedScope || unsupportedCommand) warnings.push('This exception, negated check or automatic data-changing command cannot be executed safely. Rephrase it as an explicit supported review rule.')
  const unsupportedValidation = categoryMatch.category === 'validation' && !validator
  const mixedOperations = [/\b(?:blank|empty|missing|required|mandatory)\b/iu, /\b(?:duplicate|duplicates|duplicated|unique)\b/iu, /\b(?:invalid|valid|numeric)\b/iu].filter((pattern) => pattern.test(grammar)).length > 1
  if (mixedOperations) warnings.push('This instruction mixes checks that cannot be represented by a single plan. Write each check as a separate rule.')
  const status =
    vagueDuplicate || conditionalMissing || unsupportedValidation || unrepresentedPredicate || unsupportedScope || unsupportedCommand || externalData || mixedOperations
      ? 'unsupported'
      : bindings.some((binding) => binding.status !== 'resolved')
        ? 'needs_mapping'
        : 'valid'
  const fieldConfidence =
    bindings.length === 0
      ? 0.5
      : bindings.reduce((total, binding) => total + (binding.candidates[0]?.score ?? 0), 0) / bindings.length
  const comparison =
    categoryMatch.category === 'duplicate'
      ? 'equals'
      : categoryMatch.category === 'similarity'
        ? 'similarity'
        : categoryMatch.category === 'normalization'
          ? 'equals'
          : categoryMatch.category === 'uniqueness'
            ? 'unique'
            : categoryMatch.category === 'consistency'
              ? 'consistent'
              : categoryMatch.category === 'missing'
                ? 'required'
                : 'validate'

  return {
    id: rule.id,
    sourceText: rule.sourceText,
    ...metadata,
    category: categoryMatch.category,
    status,
    entity: detectEntity(normalizedText),
    purpose: purposeForCategory(categoryMatch.category),
    fields: bindings,
    normalizations,
    logic: /\b(or|either)\b/u.test(normalizedText) ? 'or' : 'and',
    comparison,
    similarity: categoryMatch.category === 'similarity' ? extractSimilarity(normalizedText) : undefined,
    validator,
    severity: metadata.priority ? prioritySeverity(metadata.priority) : detectSeverity(normalizedText, categoryMatch.category),
    interpretationConfidence: Number((categoryMatch.confidence * fieldConfidence).toFixed(3)),
    explanation: `${purposeForCategory(categoryMatch.category)} using ${bindings.length || 'no'} identified field${bindings.length === 1 ? '' : 's'}.`,
    warnings
  }
}

export function interpretRules(
  rules: SourceRule[],
  profile?: WorksheetProfile,
  columnMappings: Record<string, string> = {},
  context: RuleInterpretationContext = {}
): RuleInterpretation[] {
  return rules.filter((rule) => rule.enabled).map((rule) => interpretRule(rule, profile, columnMappings, context))
}
