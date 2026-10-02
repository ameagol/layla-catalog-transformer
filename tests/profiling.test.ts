import { describe, expect, it } from 'vitest'

import { createDatasetColumns, detectHeaderRow } from '../src/core/dataset/headerDetection'
import { profileWorksheet } from '../src/core/dataset/profiling'

describe('dataset profiling', () => {
  it('detects a header below a title row', () => {
    expect(
      detectHeaderRow([
        ['Customer extract', null, null],
        ['Name', 'Phone', 'Email'],
        ['João Silva', '(11) 2030-9090', 'joao@example.com']
      ])
    ).toBe(2)
  })

  it('disambiguates duplicate and missing headers', () => {
    const result = createDatasetColumns(['Name', 'Name', null])
    expect(result.columns.map((column) => column.key)).toEqual(['name', 'name_2', 'column_3'])
    expect(result.warnings).toHaveLength(2)
  })

  it('infers common Portuguese and English column meanings', () => {
    const columns = createDatasetColumns(['Nome Cliente', 'Telefone', 'Email']).columns
    const profile = profileWorksheet('Customers', 1, columns, [
      { rowNumber: 2, values: { nome_cliente: 'João Silva', telefone: '(11) 2030-9090', email: 'joao@example.com' } },
      { rowNumber: 3, values: { nome_cliente: 'Maria Souza', telefone: '(21) 2222-3344', email: 'maria@example.com' } }
    ])
    expect(profile.columns.map((column) => column.semanticType)).toEqual(['name', 'phone', 'email'])
  })
})

