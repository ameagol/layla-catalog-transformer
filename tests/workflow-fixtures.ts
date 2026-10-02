import { createProjectRecord } from '../src/core/model/defaults'
import type { AnalysisResult, ProjectRecord, WorkbookProfile } from '../src/core/model/domain'
import { compileRules } from '../src/core/rules/compiler'
import { parseSourceRules } from '../src/core/rules/source'
import { createCustomerProfile } from './fixtures'
import { createFinding } from './finding-fixtures'

export function workflowWorkbook(update: Partial<WorkbookProfile> = {}): WorkbookProfile {
  return {
    sessionId: '00000000-0000-4000-8000-000000000102',
    fileName: 'quality.xlsx', fileSize: 100, modifiedAt: '2026-10-01T00:00:00Z',
    sheets: [{ name: 'Customers', estimatedRowCount: 1, estimatedColumnCount: 4 }],
    selectedSheet: createCustomerProfile([{ rowNumber: 2, values: { name: 'Customer', phone: '1120209090', email: '', cpf: '' } }]),
    ...update
  }
}

export function workflowProject(update: Partial<ProjectRecord> = {}): ProjectRecord {
  return {
    ...createProjectRecord('Quality'),
    id: '00000000-0000-4000-8000-000000000101',
    sourceFilePath: 'C:\\data\\quality.xlsx', selectedSheet: 'Customers',
    rulesText: 'Flag rows with a missing email.',
    ...update
  }
}

export function workflowCompilation(rulesText = workflowProject().rulesText, mappings: Record<string, string> = {}) {
  return compileRules(parseSourceRules(rulesText), workflowWorkbook().selectedSheet, mappings)
}

export function workflowAnalysis(update: Partial<AnalysisResult> = {}): AnalysisResult {
  return {
    id: '00000000-0000-4000-8000-000000000104', projectId: workflowProject().id,
    sessionId: workflowWorkbook().sessionId, sheetName: 'Customers',
    startedAt: '2026-10-01T00:00:00Z', completedAt: '2026-10-01T00:00:01Z', durationMs: 1000,
    rowsAnalyzed: 2, rulesExecuted: 1, findings: [createFinding()], warnings: [],
    summary: { totalFindings: 1, duplicateGroups: 1, possibleDuplicateGroups: 0, invalidValues: 0, missingValues: 0, consistencyViolations: 0, uniquenessViolations: 0, ruleViolations: 0 },
    compilation: workflowCompilation(), ...update
  }
}
