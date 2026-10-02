import type { CellValue, SemanticCandidate, SemanticType } from '../model/domain'
import { normalizeBrazilianPhone, normalizeIdentifier, stringifyCellValue } from '../normalization/normalizers'
import { isValidBrazilianPhone, isValidCnpj, isValidCpf } from '../validation/validators'

const HEADER_ALIASES: Partial<Record<SemanticType, string[]>> = {
  name: [
    'name',
    'full name',
    'customer name',
    'client name',
    'nome',
    'nome completo',
    'nome cliente',
    'razao social'
  ],
  phone: [
    'phone',
    'phone number',
    'mobile',
    'cellphone',
    'contact phone',
    'telefone',
    'telefone cliente',
    'celular',
    'fone',
    'contato'
  ],
  email: ['email', 'e mail', 'email address', 'customer email', 'correio eletronico'],
  cpf: ['cpf', 'cpf cliente', 'documento cpf', 'tax id cpf'],
  cnpj: ['cnpj', 'cnpj cliente', 'documento cnpj', 'tax id cnpj'],
  identifier: [
    'id',
    'identifier',
    'customer id',
    'client id',
    'account number',
    'document number',
    'invoice number',
    'order id',
    'codigo',
    'codigo cliente',
    'identificador',
    'numero documento',
    'numero pedido'
  ],
  date: ['date', 'birth date', 'birthday', 'created date', 'data', 'data nascimento', 'nascimento'],
  number: ['amount', 'quantity', 'total', 'value', 'valor', 'quantidade'],
  text: ['description', 'notes', 'comment', 'descricao', 'observacao']
}

export function normalizeFieldLabel(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .toLocaleLowerCase('en-US')
    .replace(/[_\-./\\]+/gu, ' ')
    .replace(/[^a-z0-9\s]+/gu, '')
    .replace(/\s+/gu, ' ')
    .trim()
}

function headerScore(header: string, aliases: string[]): { score: number; reason: string } {
  let best = { score: 0, reason: '' }

  for (const alias of aliases) {
    if (header === alias) {
      return { score: 0.99, reason: `Header exactly matches the known alias “${alias}”.` }
    }

    if (header.startsWith(`${alias} `) || header.endsWith(` ${alias}`)) {
      best = { score: Math.max(best.score, 0.91), reason: `Header contains the alias “${alias}”.` }
    } else if (header.includes(alias) && alias.length >= 3) {
      best = { score: Math.max(best.score, 0.84), reason: `Header contains the term “${alias}”.` }
    }
  }

  return best
}

function sampleScore(semanticType: SemanticType, values: string[]): { score: number; reason: string } {
  if (values.length === 0) {
    return { score: 0, reason: '' }
  }

  const ratio = (predicate: (value: string) => boolean): number => values.filter(predicate).length / values.length

  if (semanticType === 'email') {
    const matchRatio = ratio((value) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/u.test(value.trim()))
    return { score: matchRatio * 0.86, reason: `${Math.round(matchRatio * 100)}% of sampled values look like email addresses.` }
  }

  if (semanticType === 'cpf') {
    const validRatio = ratio((value) => isValidCpf(value))
    const shapeRatio = ratio((value) => normalizeIdentifier(value).length === 11)
    return {
      score: Math.max(validRatio * 0.98, shapeRatio * 0.64),
      reason: `${Math.round(validRatio * 100)}% of sampled values have valid CPF checksums.`
    }
  }

  if (semanticType === 'cnpj') {
    const validRatio = ratio((value) => isValidCnpj(value))
    const shapeRatio = ratio((value) => normalizeIdentifier(value).length === 14)
    return {
      score: Math.max(validRatio * 0.98, shapeRatio * 0.64),
      reason: `${Math.round(validRatio * 100)}% of sampled values have valid CNPJ checksums.`
    }
  }

  if (semanticType === 'phone') {
    const validRatio = ratio((value) => isValidBrazilianPhone(value))
    const shapeRatio = ratio((value) => /^\d{10,13}$/u.test(value.replace(/\D/gu, '')))
    return {
      score: Math.max(validRatio * 0.92, shapeRatio * 0.72),
      reason: `${Math.round(validRatio * 100)}% of sampled values contain valid Brazilian phone structures.`
    }
  }

  if (semanticType === 'date') {
    const dateRatio = ratio((value) => !Number.isNaN(new Date(value).getTime()))
    return { score: dateRatio * 0.72, reason: `${Math.round(dateRatio * 100)}% of sampled values parse as dates.` }
  }

  if (semanticType === 'number') {
    const numberRatio = ratio((value) => Number.isFinite(Number(value.replace(',', '.'))))
    return { score: numberRatio * 0.7, reason: `${Math.round(numberRatio * 100)}% of sampled values are numeric.` }
  }

  if (semanticType === 'name') {
    const nameRatio = ratio((value) => {
      const trimmed = value.trim()
      return /^[\p{L}' -]{3,}$/u.test(trimmed) && trimmed.split(/\s+/u).length >= 2
    })
    return { score: nameRatio * 0.48, reason: `${Math.round(nameRatio * 100)}% of sampled values resemble personal names.` }
  }

  if (semanticType === 'identifier') {
    const compactRatio = ratio((value) => normalizeIdentifier(value).length > 0 && !/\s{2,}/u.test(value))
    return { score: compactRatio * 0.35, reason: 'Sampled values have a compact identifier-like shape.' }
  }

  return { score: 0, reason: '' }
}

export function inferSemanticCandidates(header: string, sampleValues: CellValue[]): SemanticCandidate[] {
  const normalizedHeader = normalizeFieldLabel(header)
  const values = sampleValues
    .map(stringifyCellValue)
    .map((value) => value.trim())
    .filter(Boolean)
    .slice(0, 100)
  const candidates: SemanticCandidate[] = []

  for (const [semanticType, aliases] of Object.entries(HEADER_ALIASES) as Array<[SemanticType, string[]]>) {
    const fromHeader = headerScore(normalizedHeader, aliases.map(normalizeFieldLabel))
    const fromSamples = sampleScore(semanticType, values)
    const score = Math.min(0.99, Math.max(fromHeader.score, fromHeader.score * 0.75 + fromSamples.score * 0.45, fromSamples.score))
    const reasons = [fromHeader.reason, fromSamples.reason].filter(Boolean)

    if (score >= 0.25) {
      candidates.push({ semanticType, score: Number(score.toFixed(3)), reasons })
    }
  }

  return candidates.sort((left, right) => right.score - left.score)
}

export function selectSemanticType(candidates: SemanticCandidate[]): { semanticType: SemanticType; confidence: number } {
  const first = candidates[0]
  const second = candidates[1]

  if (!first || first.score < 0.62 || (second && first.score - second.score < 0.1)) {
    return { semanticType: 'unknown', confidence: first?.score ?? 0 }
  }

  return { semanticType: first.semanticType, confidence: first.score }
}

export function phoneFormatPattern(value: CellValue): string {
  const source = stringifyCellValue(value).trim()
  const pattern = source.replace(/\d/gu, '9').replace(/\p{L}/gu, 'A')
  return pattern || normalizeBrazilianPhone(source)
}

