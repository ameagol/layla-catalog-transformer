import { mkdir, readdir, readFile, rm } from 'node:fs/promises'
import { isAbsolute, join, relative, resolve } from 'node:path'

import type { AnalysisResult, CreateProjectInput, ProjectRecord, UpdateProjectDetailsInput, UpdateProjectInput } from '@core/model/domain'
import { createProjectRecord } from '@core/model/defaults'

import { readJsonFile, writeJsonAtomic, writeTextAtomic } from './fileStore'
import { removeLegacyDemoContent } from './removeLegacyDemoContent'

type ProjectMetadata = Omit<ProjectRecord, 'rulesText'>

export class ProjectStore {
  private readonly projectsRoot: string

  constructor(private readonly userDataPath: string) {
    this.projectsRoot = join(userDataPath, 'projects')
  }

  async initialize(): Promise<void> {
    await mkdir(this.projectsRoot, { recursive: true })
    await removeLegacyDemoContent(this.userDataPath)
  }

  async list(): Promise<ProjectRecord[]> {
    await mkdir(this.projectsRoot, { recursive: true })
    const entries = await readdir(this.projectsRoot, { withFileTypes: true })
    const projects = await Promise.all(
      entries
        .filter((entry) => entry.isDirectory())
        .map(async (entry) => {
          try {
            return await this.get(entry.name)
          } catch {
            return null
          }
        })
    )

    return projects
      .filter((project): project is ProjectRecord => project !== null)
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
  }

  async create(input: CreateProjectInput, persistAnalysisResults = false): Promise<ProjectRecord> {
    const project = createProjectRecord(input.name, input.description)
    project.persistAnalysisResults = persistAnalysisResults
    await this.writeProject(project)
    return project
  }

  async get(projectId: string): Promise<ProjectRecord> {
    const directory = this.projectDirectory(projectId)
    const metadata = await readJsonFile<ProjectMetadata>(join(directory, 'project.json'))
    const rulesText = await readFile(join(directory, 'rules.txt'), 'utf8').catch(() => '')
    return { ...metadata, ruleImpacts: metadata.ruleImpacts ?? {}, rulesText }
  }

  async update(input: UpdateProjectInput): Promise<ProjectRecord> {
    const existing = await this.get(input.id)
    const project: ProjectRecord = {
      ...existing,
      ...input,
      ruleImpacts: input.ruleImpacts ?? existing.ruleImpacts,
      ruleConfigurations: input.ruleConfigurations ?? existing.ruleConfigurations,
      updatedAt: new Date().toISOString(),
      analysisHistory: existing.analysisHistory
    }
    await this.writeProject(project)
    return project
  }

  async updateDetails(input: UpdateProjectDetailsInput): Promise<ProjectRecord> {
    const existing = await this.get(input.id)
    const project = { ...existing, name: input.name, description: input.description, updatedAt: new Date().toISOString() }
    await this.writeProject(project)
    return project
  }

  async delete(projectId: string): Promise<void> {
    const directory = this.projectDirectory(projectId)
    const resolvedRoot = resolve(this.projectsRoot)
    const resolvedDirectory = resolve(directory)
    const relativePath = relative(resolvedRoot, resolvedDirectory)
    if (!relativePath || relativePath.startsWith('..') || isAbsolute(relativePath)) {
      throw new Error('Refusing to delete a path outside the local projects directory.')
    }
    await rm(resolvedDirectory, { recursive: true, force: true })
  }

  async recordAnalysis(projectId: string, result: AnalysisResult): Promise<ProjectRecord> {
    const project = await this.get(projectId)
    const historyItem = {
      id: result.id,
      sheetName: result.sheetName,
      completedAt: result.completedAt,
      rowsAnalyzed: result.rowsAnalyzed,
      summary: result.summary
    }
    const updated: ProjectRecord = {
      ...project,
      updatedAt: result.completedAt,
      analysisHistory: [historyItem, ...project.analysisHistory.filter((item) => item.id !== result.id)].slice(0, 50)
    }
    await this.writeProject(updated)
    if (updated.persistAnalysisResults) {
      await writeJsonAtomic(join(this.projectDirectory(projectId), 'analyses', `${result.id}.json`), result)
    }
    return updated
  }

  private projectDirectory(projectId: string): string {
    if (!/^[0-9a-f-]{36}$/iu.test(projectId)) {
      throw new Error('Invalid project identifier.')
    }
    return join(this.projectsRoot, projectId)
  }

  private async writeProject(project: ProjectRecord): Promise<void> {
    const directory = this.projectDirectory(project.id)
    await mkdir(directory, { recursive: true })
    const { rulesText, ...metadata } = project
    await Promise.all([
      writeJsonAtomic(join(directory, 'project.json'), metadata),
      writeTextAtomic(join(directory, 'rules.txt'), rulesText.trimEnd() ? `${rulesText.trimEnd()}\n` : '')
    ])
  }
}
