import type { AnalysisSummary, AppSettings, ProjectRecord } from './domain'

export const EMPTY_ANALYSIS_SUMMARY: AnalysisSummary = {
  totalFindings: 0,
  duplicateGroups: 0,
  possibleDuplicateGroups: 0,
  invalidValues: 0,
  missingValues: 0,
  consistencyViolations: 0,
  uniquenessViolations: 0,
  ruleViolations: 0
}

export const DEFAULT_SETTINGS: AppSettings = {
  provider: {
    kind: 'laya',
    endpoint: '',
    model: 'convaiinnovations/laya/multilingual',
    apiKeyConfigured: false,
    sendColumnExamples: false
  },
  copilot: {
    endpoint: '',
    model: '',
    apiKeyConfigured: false,
    sendFindingEvidence: false
  },
  defaultPersistAnalysisResults: false,
  theme: 'light'
}

export function createProjectRecord(name: string, description = ''): ProjectRecord {
  const now = new Date().toISOString()

  return {
    id: crypto.randomUUID(),
    name: name.trim(),
    description: description.trim(),
    createdAt: now,
    updatedAt: now,
    rulesText: '',
    disabledRuleIds: [],
    ruleImpacts: {},
    columnMappings: {},
    persistAnalysisResults: false,
    analysisHistory: []
  }
}
