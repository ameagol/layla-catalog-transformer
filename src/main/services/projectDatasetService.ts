import type { ProjectDataset, WorkbookProfile } from '@core/model/domain'
import { reconnectRuleConfigurations } from '@core/rules/configuration'

import type { ProjectStore } from './projectStore'
import type { WorkbookService } from './workbookService'

export class ProjectDatasetService {
  constructor(private readonly projects: ProjectStore, private readonly workbooks: WorkbookService) {}

  async choose(projectId: string, window: Electron.BrowserWindow): Promise<ProjectDataset | null> {
    await this.projects.get(projectId)
    const workbook = await this.workbooks.chooseWorkbook(window)
    return workbook ? this.attach(projectId, workbook) : null
  }

  async inspect(projectId: string, filePath: string): Promise<ProjectDataset> {
    await this.projects.get(projectId)
    const workbook = await this.workbooks.inspectPath(filePath)
    return this.attach(projectId, workbook)
  }

  async open(projectId: string): Promise<WorkbookProfile | null> {
    const project = await this.projects.get(projectId)
    if (!project.sourceFilePath) return null
    return this.workbooks.inspectPath(project.sourceFilePath, project.selectedSheet)
  }

  private async attach(projectId: string, workbook: WorkbookProfile): Promise<ProjectDataset> {
    const existing = await this.projects.get(projectId)
    const sourceFilePath = this.workbooks.getSourcePath(workbook.sessionId)
    const project = await this.projects.update({
      ...existing,
      sourceFilePath,
      selectedSheet: workbook.selectedSheet.name,
      columnMappings: existing.sourceFilePath === sourceFilePath ? existing.columnMappings : {},
      ruleConfigurations: reconnectRuleConfigurations(existing.ruleConfigurations, existing.sourceFilePath === sourceFilePath)
    })
    return { project, workbook }
  }
}
