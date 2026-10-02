import type { CellValue, NormalizationOperation, SemanticType } from '../model/domain'

const NORMALIZATION_ORDER: NormalizationOperation[] = [
  'unicode',
  'trim',
  'lowercase',
  'uppercase',
  'remove_accents',
  'normalize_whitespace',
  'remove_whitespace',
  'remove_punctuation',
  'digits_only',
  'phone_br',
  'email',
  'identifier'
]

const DEFAULT_OPERATIONS: Record<SemanticType, NormalizationOperation[]> = {
  name: ['unicode', 'trim', 'lowercase', 'remove_accents', 'normalize_whitespace'],
  phone: ['phone_br'],
  email: ['email'],
  cpf: ['identifier'],
  cnpj: ['identifier'],
  identifier: ['trim', 'identifier'],
  date: ['trim'],
  number: ['trim'],
  text: ['unicode', 'trim', 'normalize_whitespace'],
  unknown: ['unicode', 'trim', 'normalize_whitespace']
}

export function stringifyCellValue(value: CellValue): string {
  if (value === null) {
    return ''
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? '' : value.toISOString()
  }

  return String(value)
}

export function isMissingValue(value: CellValue): boolean {
  return value === null || stringifyCellValue(value).trim().length === 0
}

export function normalizeBrazilianPhone(value: string): string {
  let digits = value.replace(/\D/gu, '')

  if ((digits.length === 12 || digits.length === 13) && digits.startsWith('55')) {
    digits = digits.slice(2)
  }

  if ((digits.length === 11 || digits.length === 12) && digits.startsWith('0')) {
    digits = digits.slice(1)
  }

  return digits
}

export function normalizeIdentifier(value: string): string {
  const trimmed = value.trim()
  const digits = trimmed.replace(/\D/gu, '')

  return digits.length > 0 ? digits : trimmed
}

export function mergeNormalizations(
  semanticType: SemanticType,
  ...operationGroups: NormalizationOperation[][]
): NormalizationOperation[] {
  const operations = new Set<NormalizationOperation>(DEFAULT_OPERATIONS[semanticType])

  const compatible = (operation: NormalizationOperation): boolean => {
    if (operation === 'phone_br') return semanticType === 'phone'
    if (operation === 'email') return semanticType === 'email'
    if (operation === 'identifier') return ['cpf', 'cnpj', 'identifier'].includes(semanticType)
    if (operation === 'digits_only') return ['phone', 'cpf', 'cnpj', 'identifier', 'number'].includes(semanticType)
    return true
  }

  for (const operationGroup of operationGroups) {
    for (const operation of operationGroup) {
      if (compatible(operation)) operations.add(operation)
    }
  }

  return NORMALIZATION_ORDER.filter((operation) => operations.has(operation))
}

export function normalizeValue(
  value: CellValue,
  operations: NormalizationOperation[],
  semanticType: SemanticType = 'unknown'
): string {
  let normalized = stringifyCellValue(value)
  const orderedOperations = mergeNormalizations(semanticType, operations)

  for (const operation of orderedOperations) {
    switch (operation) {
      case 'unicode':
        normalized = normalized.normalize('NFKC')
        break
      case 'trim':
        normalized = normalized.trim()
        break
      case 'lowercase':
        normalized = normalized.toLocaleLowerCase('en-US')
        break
      case 'uppercase':
        normalized = normalized.toLocaleUpperCase('en-US')
        break
      case 'remove_accents':
        normalized = normalized.normalize('NFD').replace(/\p{M}+/gu, '').normalize('NFC')
        break
      case 'normalize_whitespace':
        normalized = normalized.replace(/\s+/gu, ' ').trim()
        break
      case 'remove_whitespace':
        normalized = normalized.replace(/\s+/gu, '')
        break
      case 'remove_punctuation':
        normalized = normalized.replace(/[\p{P}\p{S}]+/gu, ' ').replace(/\s+/gu, ' ').trim()
        break
      case 'digits_only':
        normalized = normalized.replace(/\D/gu, '')
        break
      case 'phone_br':
        normalized = normalizeBrazilianPhone(normalized)
        break
      case 'email':
        normalized = normalized.trim().toLocaleLowerCase('en-US')
        break
      case 'identifier':
        normalized = normalizeIdentifier(normalized)
        break
    }
  }

  return normalized
}

export function describeNormalizations(operations: NormalizationOperation[]): string[] {
  const labels: Record<NormalizationOperation, string> = {
    unicode: 'Unicode canonicalization',
    trim: 'trim surrounding spaces',
    lowercase: 'ignore capitalization',
    uppercase: 'uppercase canonicalization',
    remove_accents: 'ignore accents',
    normalize_whitespace: 'collapse repeated spaces',
    remove_whitespace: 'ignore all whitespace',
    remove_punctuation: 'ignore punctuation',
    digits_only: 'compare digits only',
    phone_br: 'Brazilian phone canonicalization',
    email: 'case-insensitive email canonicalization',
    identifier: 'identifier formatting removal'
  }

  return operations.map((operation) => labels[operation])
}
