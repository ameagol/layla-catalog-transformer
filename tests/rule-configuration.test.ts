import { describe, expect, it } from 'vitest'

import { reconnectRuleConfigurations } from '../src/core/rules/configuration'
import { ruleConfigurationsSchema, reviewedWorkbookInputSchema } from '../src/core/ipc/schemas'
import { workflowAnalysis } from './workflow-fixtures'

const configuration = { 'rule-1-test': {
  priority: 'medium_high' as const, actionItem: 'Route to the Data Steward.',
  conditionValues: { 'Account Type': ['Grower', 'Distributor'] },
  reference: { sheetName: 'Owners', columnMappings: { 'Owner ID': 'owner' } },
  similarity: { threshold: 0.9, weights: { Name: 0.4, Address: 0.4, 'Postal code': 0.2 } }
} }

describe('rule policy schema and workbook replacement', () => {
  it('round-trips inline values and removes legacy reference configuration even on the same workbook', () => {
    expect(ruleConfigurationsSchema.parse(JSON.parse(JSON.stringify(configuration)))).toEqual(configuration)
    expect(reconnectRuleConfigurations(configuration, true)).toEqual({ 'rule-1-test': { ...configuration['rule-1-test'], reference: undefined } })
  })
  it('retains policy but discards workbook-specific reference mappings on replacement', () => {
    expect(reconnectRuleConfigurations(configuration, false)).toEqual({ 'rule-1-test': { ...configuration['rule-1-test'], reference: undefined } })
    expect(configuration['rule-1-test'].reference.sheetName).toBe('Owners')
    expect(reconnectRuleConfigurations(undefined, false)).toBeUndefined()
  })
  it.each([{ priority: 'urgent' }, { actionItem: '' }, { actionItem: ' ' }, { actionItem: 'x'.repeat(2001) }])('rejects invalid policy overrides: %j', (override) => {
    expect(() => ruleConfigurationsSchema.parse({ 'rule-1-test': override })).toThrow()
  })
  it('rejects duplicate and invalid accepted row IDs', () => {
    for (const acceptedRowNumbers of [[2, 2], [0], [-1], [2.1]]) expect(() => reviewedWorkbookInputSchema.parse({ analysisId: workflowAnalysis().id, acceptedRowNumbers })).toThrow()
  })
})
