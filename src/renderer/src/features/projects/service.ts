import type { CreateProjectInput, ProjectRecord, UpdateProjectDetailsInput, UpdateProjectInput } from '@core/model/domain'

export const projectService = {
  list: (): Promise<ProjectRecord[]> => window.catalogTransformer.listProjects(),
  create: (input: CreateProjectInput): Promise<ProjectRecord> => window.catalogTransformer.createProject(input),
  get: (projectId: string): Promise<ProjectRecord> => window.catalogTransformer.getProject(projectId),
  update: (input: UpdateProjectInput): Promise<ProjectRecord> => window.catalogTransformer.updateProject(input),
  updateDetails: (input: UpdateProjectDetailsInput): Promise<ProjectRecord> => window.catalogTransformer.updateProjectDetails(input),
  delete: (projectId: string): Promise<void> => window.catalogTransformer.deleteProject(projectId)
}
