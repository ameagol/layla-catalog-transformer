import { describe, expect, it } from 'vitest'

import { analyzeDataset } from '../src/core/engine/analyze'
import { compileRules } from '../src/core/rules/compiler'
import { parseSourceRules } from '../src/core/rules/source'
import { createCustomerProfile } from './fixtures'
import { AnalysisService } from '../src/main/services/analysisService'
import type { WorkbookService } from '../src/main/services/workbookService'
import type { ProjectStore } from '../src/main/services/projectStore'
import { mockLayaNlp } from './laya-fixtures'

describe('natural language to deterministic findings', () => {
  it('detects duplicate groups, invalid phones, missing emails, and CPF conflicts', async () => {
    const rows = [
      { rowNumber: 2, values: { name: 'João Silva', phone: '11-20309090', email: 'joao@example.com', cpf: '529.982.247-25' } },
      { rowNumber: 3, values: { name: 'João Silva', phone: '(11) 2030-9090', email: 'JOAO@example.com', cpf: '52998224725' } },
      { rowNumber: 4, values: { name: 'Maria Souza', phone: '(11) 99999-8888', email: '', cpf: '111.444.777-35' } },
      { rowNumber: 5, values: { name: 'Mariana Souza', phone: '(00) 99999-7777', email: 'mariana@example.com', cpf: '11144477735' } }
    ]
    const rules = parseSourceRules(`Consider customers duplicates when their name and phone are equal after ignoring accents, capitalization, spaces and phone formatting.

A CPF must not be associated with different customer names.

Brazilian phone numbers must contain a valid DDD.

Flag customers with a missing email.`)
    const compilation = compileRules(rules, createCustomerProfile(rows), {})
    expect(compilation.canRun).toBe(true)

    const result = await analyzeDataset({
      projectId: '00000000-0000-4000-8000-000000000001',
      sessionId: '00000000-0000-4000-8000-000000000002',
      sheetName: 'Customers',
      rows,
      compilation
    })

    const duplicate = result.findings.find((finding) => finding.type === 'DUPLICATE')
    expect(duplicate?.rowNumbers).toEqual([2, 3])
    expect(duplicate?.evidence.some((evidence) => evidence.normalizedValue === '1120309090')).toBe(true)
    expect(result.summary.invalidValues).toBe(1)
    expect(result.summary.missingValues).toBe(1)
    expect(result.summary.consistencyViolations).toBe(1)
  })

  it('attaches the user-selected impact to findings for later review', async () => {
    const rows = [{ rowNumber: 2, values: { name: 'Row A', phone: '', email: '', cpf: '' } }]
    const rulesText = 'Flag customers with a missing email.'
    const rule = parseSourceRules(rulesText)[0]!
    const analysis = new AnalysisService(
      { getWorksheetData: async () => ({ rows, profile: createCustomerProfile(rows) }) } as unknown as WorkbookService,
      { recordAnalysis: async () => undefined } as unknown as ProjectStore,
      mockLayaNlp()
    )
    const result = await analysis.run({
      projectId: '00000000-0000-4000-8000-000000000001',
      sessionId: '00000000-0000-4000-8000-000000000002',
      sheetName: 'Customers', rulesText, disabledRuleIds: [], columnMappings: {},
      ruleImpacts: { [rule.id]: 'large' }
    })
    expect(result.findings[0]?.impactLevel).toBe('large')
    const defaultResult = await analysis.run({
      projectId: '00000000-0000-4000-8000-000000000001',
      sessionId: '00000000-0000-4000-8000-000000000002',
      sheetName: 'Customers', rulesText, disabledRuleIds: [], columnMappings: {}, ruleImpacts: {}
    })
    expect(defaultResult.findings[0]?.impactLevel).toBe('medium')
  })
})
