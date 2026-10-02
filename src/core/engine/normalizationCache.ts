import type { DatasetRow, NormalizationOperation, ResolvedField } from '../model/domain'
import { normalizeValue } from '../normalization/normalizers'

export class NormalizationCache {
  private readonly values = new Map<string, string>()

  get(row: DatasetRow, field: ResolvedField, operations: NormalizationOperation[]): string {
    const cacheKey = `${row.rowNumber}:${field.columnKey}:${operations.join(',')}`
    const cached = this.values.get(cacheKey)

    if (cached !== undefined) {
      return cached
    }

    const normalized = normalizeValue(row.values[field.columnKey] ?? null, operations, field.semanticType)
    this.values.set(cacheKey, normalized)
    return normalized
  }

  clear(): void {
    this.values.clear()
  }
}

