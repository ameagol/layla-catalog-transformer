import type { DatasetColumn, DatasetRow, Finding } from '../src/core/model/domain'

export const findingColumns: DatasetColumn[] = [
  { key: 'phone', header: 'Phone', index: 10 },
  { key: 'id', header: 'ID', index: 0 },
  { key: 'notes', header: 'Internal notes', index: 3 },
  { key: 'email', header: 'Email', index: 2 },
  { key: 'name', header: 'Name', index: 1 }
]

export const findingRows: DatasetRow[] = [
  { rowNumber: 2, values: { id: 0, name: 'Customer A', email: 'a@example.test', phone: '11 - 20209090', notes: 'Unrelated data' } },
  { rowNumber: 204, values: { id: 204, name: 'Customer B', email: null, phone: '(11) 2020-9090', notes: 'More unrelated data' } }
]

export function createFinding(update: Partial<Finding> = {}): Finding {
  return {
    id: 'finding-abc123', type: 'DUPLICATE', severity: 'warning', confidence: 'HIGH',
    ruleId: 'rule-phone', ruleText: 'Phone numbers must be unique.', sheet: 'Customers',
    rowNumbers: [2, 204], fields: ['Phone'],
    evidence: findingRows.map((row) => ({
      rowNumber: row.rowNumber, columnKey: 'phone', columnHeader: 'Phone',
      originalValue: row.values.phone ?? null, normalizedValue: '1120209090', comparator: 'exact'
    })),
    explanation: 'These rows have the same normalized phone.', suggestedAction: 'Review the source rows.',
    createdAt: '2026-10-01T00:00:00Z', ...update
  }
}
