import type { DatasetRow } from '../src/core/model/domain'

export const reportedRules = [
  'identify duplicated names',
  'check for duplicated phones with same numbers and different formats like (19) 9090-1010, 19 90901010, 19-90901010',
  'check for empty names'
] as const

export const ruleLanguageRows: DatasetRow[] = [
  { rowNumber: 2, values: { name: 'Ana Silva', phone: '(19) 9090-1010', email: 'ana@example.test', cpf: '' } },
  { rowNumber: 3, values: { name: 'ANA SILVA', phone: '19 90901010', email: 'ana.other@example.test', cpf: '' } },
  { rowNumber: 4, values: { name: 'Bruno Costa', phone: '19-90901010', email: 'bruno@example.test', cpf: '' } },
  { rowNumber: 5, values: { name: '', phone: '19 80808080', email: 'empty@example.test', cpf: '' } },
  { rowNumber: 6, values: { name: '   ', phone: '19 80808081', email: 'spaces@example.test', cpf: '' } },
  { rowNumber: 7, values: { name: null, phone: '19 80808082', email: 'null@example.test', cpf: '' } },
  { rowNumber: 8, values: { name: 'Different area', phone: '(11) 9090-1010', email: 'area@example.test', cpf: '' } },
  { rowNumber: 9, values: { name: '0', phone: null, email: 'zero@example.test', cpf: '' } }
]
