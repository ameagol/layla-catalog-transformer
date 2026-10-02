import { join, resolve } from 'node:path'

import { CopilotService } from '../src/main/services/copilotService.ts'

const analysisId = '00000000-0000-4000-8000-000000000001'
const finding = {
  id: 'finding-abc123', type: 'POSSIBLE_DUPLICATE', severity: 'warning', confidence: 'MEDIUM',
  ruleId: 'rule-1', ruleText: 'Consider customers duplicates when their name and phone are equal after ignoring accents, capitalization, spaces and phone formatting.',
  sheet: 'Customers', rowNumbers: [2, 3], fields: ['Name', 'Phone'], evidence: [],
  explanation: 'Review possible duplicate', suggestedAction: 'Compare source records', createdAt: '2026-01-01'
}
const analysis = { getActiveResult: (id) => ({ id, findings: [finding] }) }
const userData = process.argv[2] ? resolve(process.argv[2]) : join(process.env.APPDATA ?? '', 'catalog-transformer')
const copilot = new CopilotService(analysis, {}, userData)
const result = await copilot.guide(analysisId, finding.id)
console.log(result)
if (result.status !== 'laya' || result.route !== 'review_duplicate') {
  throw new Error('Expected a real Laya route for the representative possible duplicate.')
}
console.log('CATALOG_TRANSFORMER_LAYA_DECISION_OK')
