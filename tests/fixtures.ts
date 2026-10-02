import type { DatasetColumn, DatasetRow, WorksheetProfile } from '../src/core/model/domain'
import { profileWorksheet } from '../src/core/dataset/profiling'

export const customerColumns: DatasetColumn[] = [
  { key: 'name', header: 'Name', index: 0 },
  { key: 'phone', header: 'Phone', index: 1 },
  { key: 'email', header: 'Email', index: 2 },
  { key: 'cpf', header: 'CPF', index: 3 }
]

export function createCustomerProfile(rows: DatasetRow[]): WorksheetProfile {
  return profileWorksheet('Customers', 1, customerColumns, rows)
}

