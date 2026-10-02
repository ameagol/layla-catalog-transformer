import type { ProjectDataset, WorkbookProfile } from '@core/model/domain'

export const datasetService = {
  choose: (projectId: string): Promise<ProjectDataset | null> => window.catalogTransformer.chooseWorkbook(projectId),
  open: (projectId: string): Promise<WorkbookProfile | null> => window.catalogTransformer.getProjectWorkbook(projectId),
  inspectDroppedFile: (projectId: string, file: File): Promise<ProjectDataset> => {
    const filePath = window.catalogTransformer.getPathForDroppedFile(file)
    if (!filePath) throw new Error('The dropped file path could not be resolved.')
    return window.catalogTransformer.inspectWorkbookPath(projectId, filePath)
  }
}
