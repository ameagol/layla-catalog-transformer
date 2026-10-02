import { describe, expect, it } from 'vitest'

import { isValidBrazilianPhone, isValidCnpj, isValidCpf, validateValue } from '../src/core/validation/validators'

describe('validators', () => {
  it('validates CPF checksums', () => {
    expect(isValidCpf('529.982.247-25')).toBe(true)
    expect(isValidCpf('123.456.789-00')).toBe(false)
  })

  it('validates CNPJ checksums', () => {
    expect(isValidCnpj('11.222.333/0001-81')).toBe(true)
    expect(isValidCnpj('11.111.111/1111-11')).toBe(false)
  })

  it('validates Brazilian DDD and subscriber structure', () => {
    expect(isValidBrazilianPhone('(11) 2030-9090')).toBe(true)
    expect(isValidBrazilianPhone('(31) 98888-2222')).toBe(true)
    expect(isValidBrazilianPhone('(00) 98888-2222')).toBe(false)
  })

  it('treats empty optional formatted values as skipped', () => {
    expect(validateValue('', 'email').valid).toBe(true)
    expect(validateValue('', 'required').valid).toBe(false)
  })
})

