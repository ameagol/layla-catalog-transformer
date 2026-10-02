import type { CompilationResult, InterpretationPreviewRequest, ProjectRecord, WorkbookProfile } from '@core/model/domain'

import type { RuleValidationResult } from './models'
import { projectUpdate } from '@/features/projects/helper'
import { projectService } from '@/features/projects/service'

export const rulesService = {
  interpret: (input: InterpretationPreviewRequest): Promise<CompilationResult> =>
    window.catalogTransformer.interpretRules(input),
  validateAndSave: async (project: ProjectRecord, workbook: WorkbookProfile | null): Promise<RuleValidationResult> => {
    const compilation = await rulesService.interpret({
      sessionId: workbook?.sessionId,
      sheetName: workbook?.selectedSheet.name,
      rulesText: project.rulesText,
      disabledRuleIds: project.disabledRuleIds,
      columnMappings: project.columnMappings,
      ruleConfigurations: project.ruleConfigurations
    })
    if (compilation.issues.length || compilation.interpretations.some((rule) => rule.status !== 'valid')) {
      return { compilation, project: null }
    }
    const saved = await projectService.update(projectUpdate(project, workbook?.selectedSheet.name))
    return { compilation, project: saved }
  }
}
