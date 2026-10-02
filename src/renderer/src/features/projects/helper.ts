import type { ProjectRecord, UpdateProjectInput } from '@core/model/domain'

export function formatProjectDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(value))
}

export function projectUpdate(project: ProjectRecord, selectedSheet = project.selectedSheet): UpdateProjectInput {
  return {
    id: project.id,
    name: project.name,
    description: project.description,
    rulesText: project.rulesText,
    disabledRuleIds: project.disabledRuleIds,
    ruleImpacts: project.ruleImpacts,
    ruleConfigurations: project.ruleConfigurations,
    columnMappings: project.columnMappings,
    sourceFilePath: project.sourceFilePath,
    selectedSheet,
    persistAnalysisResults: project.persistAnalysisResults
  }
}
