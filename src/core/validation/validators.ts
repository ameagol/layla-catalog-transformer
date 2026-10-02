import type { CellValue, ValidatorKind } from '../model/domain'
import { isMissingValue, normalizeBrazilianPhone, normalizeIdentifier, stringifyCellValue } from '../normalization/normalizers'

const VALID_BRAZILIAN_DDDS = new Set([
  '11',
  '12',
  '13',
  '14',
  '15',
  '16',
  '17',
  '18',
  '19',
  '21',
  '22',
  '24',
  '27',
  '28',
  '31',
  '32',
  '33',
  '34',
  '35',
  '37',
  '38',
  '41',
  '42',
  '43',
  '44',
  '45',
  '46',
  '47',
  '48',
  '49',
  '51',
  '53',
  '54',
  '55',
  '61',
  '62',
  '63',
  '64',
  '65',
  '66',
  '67',
  '68',
  '69',
  '71',
  '73',
  '74',
  '75',
  '77',
  '79',
  '81',
  '82',
  '83',
  '84',
  '85',
  '86',
  '87',
  '88',
  '89',
  '91',
  '92',
  '93',
  '94',
  '95',
  '96',
  '97',
  '98',
  '99'
])

export interface ValidationResult {
  valid: boolean
  normalizedValue: string
  reason: string
}

function hasRepeatedDigits(value: string): boolean {
  return /^(\d)\1+$/u.test(value)
}

function validateCpf(value: string): boolean {
  if (!/^\d{11}$/u.test(value) || hasRepeatedDigits(value)) {
    return false
  }

  const digits = [...value].map(Number)
  let sum = 0

  for (let index = 0; index < 9; index += 1) {
    sum += (digits[index] ?? 0) * (10 - index)
  }

  let verifier = (sum * 10) % 11
  verifier = verifier === 10 ? 0 : verifier

  if (verifier !== digits[9]) {
    return false
  }

  sum = 0
  for (let index = 0; index < 10; index += 1) {
    sum += (digits[index] ?? 0) * (11 - index)
  }

  verifier = (sum * 10) % 11
  verifier = verifier === 10 ? 0 : verifier

  return verifier === digits[10]
}

function validateCnpj(value: string): boolean {
  if (!/^\d{14}$/u.test(value) || hasRepeatedDigits(value)) {
    return false
  }

  const digits = [...value].map(Number)
  const calculateDigit = (weights: number[]): number => {
    const total = weights.reduce((sum, weight, index) => sum + (digits[index] ?? 0) * weight, 0)
    const remainder = total % 11
    return remainder < 2 ? 0 : 11 - remainder
  }

  const firstDigit = calculateDigit([5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2])
  if (firstDigit !== digits[12]) {
    return false
  }

  const secondDigit = calculateDigit([6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2])
  return secondDigit === digits[13]
}

function validateEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/u.test(value)
}

function validateBrazilianPhone(value: string): boolean {
  if (!/^\d{10,11}$/u.test(value) || !VALID_BRAZILIAN_DDDS.has(value.slice(0, 2))) {
    return false
  }

  const subscriber = value.slice(2)
  return subscriber.length === 9 ? subscriber.startsWith('9') : /^[2-5]/u.test(subscriber)
}

export function validateValue(value: CellValue, validator: ValidatorKind): ValidationResult {
  const original = stringifyCellValue(value)

  if (validator === 'required') {
    return {
      valid: !isMissingValue(value),
      normalizedValue: original.trim(),
      reason: isMissingValue(value) ? 'The value is required but empty.' : 'A value is present.'
    }
  }

  if (isMissingValue(value)) {
    return {
      valid: true,
      normalizedValue: '',
      reason: 'The optional value is empty, so format validation was skipped.'
    }
  }

  if (validator === 'email') {
    const normalizedValue = original.trim().toLocaleLowerCase('en-US')
    return {
      valid: validateEmail(normalizedValue),
      normalizedValue,
      reason: validateEmail(normalizedValue) ? 'The email format is valid.' : 'The email format is invalid.'
    }
  }

  if (validator === 'cpf') {
    const normalizedValue = normalizeIdentifier(original)
    return {
      valid: validateCpf(normalizedValue),
      normalizedValue,
      reason: validateCpf(normalizedValue) ? 'The CPF checksum is valid.' : 'The CPF checksum is invalid.'
    }
  }

  if (validator === 'cnpj') {
    const normalizedValue = normalizeIdentifier(original)
    return {
      valid: validateCnpj(normalizedValue),
      normalizedValue,
      reason: validateCnpj(normalizedValue) ? 'The CNPJ checksum is valid.' : 'The CNPJ checksum is invalid.'
    }
  }

  if (validator === 'phone_br') {
    const normalizedValue = normalizeBrazilianPhone(original)
    return {
      valid: validateBrazilianPhone(normalizedValue),
      normalizedValue,
      reason: validateBrazilianPhone(normalizedValue)
        ? 'The phone contains a valid Brazilian DDD and subscriber number.'
        : 'The phone must contain a valid Brazilian DDD and a 10 or 11 digit number.'
    }
  }

  if (validator === 'number') {
    const normalizedValue = original.trim().replace(',', '.')
    return {
      valid: Number.isFinite(Number(normalizedValue)),
      normalizedValue,
      reason: Number.isFinite(Number(normalizedValue)) ? 'The value is numeric.' : 'The value is not numeric.'
    }
  }

  const parsedDate = value instanceof Date ? value : new Date(original)
  return {
    valid: !Number.isNaN(parsedDate.getTime()),
    normalizedValue: Number.isNaN(parsedDate.getTime()) ? original.trim() : parsedDate.toISOString(),
    reason: Number.isNaN(parsedDate.getTime()) ? 'The value is not a valid date.' : 'The value is a valid date.'
  }
}

export function isValidCpf(value: CellValue): boolean {
  return validateValue(value, 'cpf').valid
}

export function isValidCnpj(value: CellValue): boolean {
  return validateValue(value, 'cnpj').valid
}

export function isValidBrazilianPhone(value: CellValue): boolean {
  return validateValue(value, 'phone_br').valid
}

