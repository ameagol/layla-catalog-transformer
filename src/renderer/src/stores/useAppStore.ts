import { create } from 'zustand'

import type {
  AnalysisProgress,
  AnalysisResult,
  AnalysisRowReview,
  AppSettings,
  CompilationResult,
  CreateProjectInput,
  ImpactLevel,
  ProjectRecord,
  ProjectDataset,
  RowDecision,
  UpdateProjectDetailsInput,
  UpdateSettingsInput,
  WorkbookProfile
} from '@core/index'
import { acceptedRowsForReview, deletedRowsForReview } from '@core/findings/review'
import type { RuleConfiguration } from '@core/model/businessRules'
import { reconnectRuleConfigurations } from '@core/rules/configuration'

import { appService } from '@/app/service'
import { analysisService } from '@/features/analysis/service'
import { datasetService } from '@/features/dataset/service'
import { findingsService } from '@/features/findings/service'
import { projectService } from '@/features/projects/service'
import { rulesService } from '@/features/rules/service'
import { settingsService } from '@/features/settings/service'
import { errorMessage } from '@/lib/error'
import { applyTheme } from '@/styles/theme'

type BusyAction =
  | 'initializing'
  | 'loading-project'
  | 'saving-project'
  | 'opening-workbook'
  | 'interpreting'
  | 'validating-rules'
  | 'running-analysis'
  | 'exporting'
  | 'saving-settings'
  | 'testing-provider'
  | null

interface AppStore {
  initialized: boolean
  busyAction: BusyAction
  error: string | null
  appVersion: string
  projects: ProjectRecord[]
  currentProject: ProjectRecord | null
  projectDirty: boolean
  workbook: WorkbookProfile | null
  compilation: CompilationResult | null
  analysis: AnalysisResult | null
  rowReview: AnalysisRowReview | null
  analysisProgress: AnalysisProgress | null
  settings: AppSettings | null
  lastExportPath: string | null
  providerTestMessage: string | null
  rulesSaveMessage: string | null
  initialize(): Promise<void>
  clearError(): void
  selectProject(projectId: string): Promise<void>
  createProject(input: CreateProjectInput): Promise<boolean>
  deleteProject(projectId: string): Promise<void>
  updateProjectDraft(update: Partial<ProjectRecord>): void
  saveProjectDetails(input: UpdateProjectDetailsInput): Promise<boolean>
  toggleRule(ruleId: string): void
  setColumnMapping(mappingKey: string, columnKey: string): void
  setRuleImpact(ruleId: string, impact: ImpactLevel): void
  setRuleConfiguration(ruleId: string, update: Partial<RuleConfiguration>): void
  chooseWorkbook(): Promise<void>
  inspectDroppedFile(file: File): Promise<void>
  previewRules(): Promise<void>
  validateAndSaveRules(): Promise<void>
  runAnalysis(): Promise<void>
  setRowDecision(analysisId: string, rowNumber: number, decision: RowDecision): void
  downloadCorrectedCsv(): Promise<void>
  downloadReviewedWorkbook(): Promise<void>
  saveSettings(input: UpdateSettingsInput): Promise<void>
  testProvider(): Promise<void>
}

let progressUnsubscribe: (() => void) | null = null

function replaceProject(projects: ProjectRecord[], project: ProjectRecord): ProjectRecord[] {
  return [project, ...projects.filter((candidate) => candidate.id !== project.id)].sort((left, right) =>
    right.updatedAt.localeCompare(left.updatedAt)
  )
}

export const useAppStore = create<AppStore>((set, get) => {
  async function loadWorkbook(load: (projectId: string) => Promise<ProjectDataset | null>): Promise<void> {
    const current = get().currentProject
    if (!current || get().busyAction) return
    set({ busyAction: 'opening-workbook', error: null })
    try {
      const result = await load(current.id)
      if (!result) {
        set({ busyAction: null })
        return
      }
      if (get().currentProject?.id !== current.id) return
      set({
        busyAction: null,
        currentProject: {
          ...get().currentProject!,
          sourceFilePath: result.project.sourceFilePath,
          selectedSheet: result.project.selectedSheet,
          columnMappings: result.project.columnMappings,
          ruleConfigurations: reconnectRuleConfigurations(get().currentProject?.ruleConfigurations, current.sourceFilePath === result.project.sourceFilePath),
          updatedAt: result.project.updatedAt
        },
        projects: replaceProject(get().projects, result.project),
        workbook: result.workbook,
        compilation: null,
        analysis: null,
        analysisProgress: null,
        lastExportPath: null,
        rulesSaveMessage: null
      })
      if (get().currentProject?.rulesText.trim()) await get().previewRules()
    } catch (error) {
      set({ busyAction: null, error: errorMessage(error) })
    }
  }

  return {
    initialized: false,
    busyAction: null,
    error: null,
    appVersion: '',
    projects: [],
    currentProject: null,
    projectDirty: false,
    workbook: null,
    compilation: null,
    analysis: null,
    rowReview: null,
    analysisProgress: null,
    settings: null,
    lastExportPath: null,
    providerTestMessage: null,
    rulesSaveMessage: null,

    initialize: async () => {
      if (get().initialized || get().busyAction === 'initializing') return
      set({ busyAction: 'initializing', error: null })
      try {
        const [projects, settings, appVersion] = await Promise.all([
          projectService.list(),
          settingsService.get(),
          appService.getVersion()
        ])
        const savedProjectId = window.localStorage.getItem('catalog-transformer:project-id')
        const currentProject = projects.find((project) => project.id === savedProjectId) ?? projects[0] ?? null
        applyTheme()
        progressUnsubscribe?.()
        progressUnsubscribe = appService.onAnalysisProgress((analysisProgress) => set({ analysisProgress }))
        set({
          initialized: true,
          busyAction: null,
          projects,
          settings,
          appVersion,
          currentProject,
          projectDirty: false
        })
        if (currentProject) await get().selectProject(currentProject.id)
        else window.localStorage.removeItem('catalog-transformer:project-id')
      } catch (error) {
        set({ busyAction: null, error: errorMessage(error) })
      }
    },

    clearError: () => set({ error: null }),

    selectProject: async (projectId) => {
      if (get().busyAction) return
      set({ busyAction: 'loading-project', error: null, workbook: null, compilation: null, analysis: null, analysisProgress: null, lastExportPath: null, rulesSaveMessage: null })
      try {
        const project = await projectService.get(projectId)
        window.localStorage.setItem('catalog-transformer:project-id', project.id)
        set({
          currentProject: project,
          projects: replaceProject(get().projects, project),
          projectDirty: false,
          workbook: null,
          compilation: null,
          analysis: null,
          lastExportPath: null
        })
        const workbook = await datasetService.open(project.id)
        set({ busyAction: null, workbook })
        if (workbook && project.rulesText.trim()) await get().previewRules()
      } catch (error) {
        set({ busyAction: null, error: errorMessage(error) })
      }
    },

    createProject: async (input) => {
      if (get().busyAction) return false
      set({ busyAction: 'saving-project', error: null })
      try {
        const project = await projectService.create(input)
        window.localStorage.setItem('catalog-transformer:project-id', project.id)
        set({
          busyAction: null,
          projects: replaceProject(get().projects, project),
          currentProject: project,
          projectDirty: false,
          workbook: null,
          compilation: null,
          analysis: null,
          analysisProgress: null,
          lastExportPath: null,
          rulesSaveMessage: null
        })
        return true
      } catch (error) {
        set({ busyAction: null, error: errorMessage(error) })
        return false
      }
    },

    deleteProject: async (projectId) => {
      if (get().busyAction) return
      set({ busyAction: 'saving-project', error: null })
      try {
        await projectService.delete(projectId)
        const projects = get().projects.filter((project) => project.id !== projectId)
        const removedActive = get().currentProject?.id === projectId
        set({ busyAction: null, projects })
        if (removedActive) {
          set({ currentProject: null, projectDirty: false, workbook: null, compilation: null, analysis: null, analysisProgress: null, lastExportPath: null, rulesSaveMessage: null })
          window.localStorage.removeItem('catalog-transformer:project-id')
          if (projects[0]) await get().selectProject(projects[0].id)
        }
      } catch (error) {
        set({ busyAction: null, error: errorMessage(error) })
      }
    },

    updateProjectDraft: (update) => {
      const currentProject = get().currentProject
      if (!currentProject) return
      const ruleSourceChanged = update.rulesText !== undefined || update.disabledRuleIds !== undefined
      const ruleConfigChanged = ruleSourceChanged || update.columnMappings !== undefined || update.ruleImpacts !== undefined || update.ruleConfigurations !== undefined
      set({
        currentProject: { ...currentProject, ...update },
        projectDirty: true,
        rulesSaveMessage: null,
        ...(ruleSourceChanged ? { compilation: null } : {}),
        ...(ruleConfigChanged ? { analysis: null, rowReview: null, analysisProgress: null, lastExportPath: null } : {})
      })
    },

    saveProjectDetails: async (input) => {
      if (get().busyAction) return false
      set({ busyAction: 'saving-project', error: null })
      try {
        const saved = await projectService.updateDetails(input)
        const current = get().currentProject
        set({
          busyAction: null,
          currentProject: current?.id === saved.id
            ? { ...current, name: saved.name, description: saved.description, updatedAt: saved.updatedAt }
            : current,
          projects: replaceProject(get().projects, saved)
        })
        return true
      } catch (error) {
        set({ busyAction: null, error: errorMessage(error) })
        return false
      }
    },

    toggleRule: (ruleId) => {
      const project = get().currentProject
      if (!project) return
      const disabledRuleIds = project.disabledRuleIds.includes(ruleId)
        ? project.disabledRuleIds.filter((id) => id !== ruleId)
        : [...project.disabledRuleIds, ruleId]
      get().updateProjectDraft({ disabledRuleIds })
    },

    setColumnMapping: (mappingKey, columnKey) => {
      const project = get().currentProject
      if (!project) return
      get().updateProjectDraft({
        columnMappings: { ...project.columnMappings, [mappingKey]: columnKey }
      })
    },

    setRuleImpact: (ruleId, impact) => {
      const project = get().currentProject
      if (!project || get().busyAction) return
      get().updateProjectDraft({ ruleImpacts: { ...project.ruleImpacts, [ruleId]: impact } })
    },

    setRuleConfiguration: (ruleId, update) => {
      const project = get().currentProject
      if (!project || get().busyAction) return
      get().updateProjectDraft({ ruleConfigurations: { ...project.ruleConfigurations, [ruleId]: { ...project.ruleConfigurations?.[ruleId], ...update } } })
    },

    chooseWorkbook: () => loadWorkbook(datasetService.choose),

    inspectDroppedFile: (file) => loadWorkbook((projectId) => datasetService.inspectDroppedFile(projectId, file)),

    previewRules: async () => {
      const project = get().currentProject
      if (!project || get().busyAction) return
      set({ busyAction: 'interpreting', error: null })
      try {
        const workbook = get().workbook
        const compilation = await rulesService.interpret({
          sessionId: workbook?.sessionId,
          sheetName: workbook?.selectedSheet.name,
          rulesText: project.rulesText,
          disabledRuleIds: project.disabledRuleIds,
          columnMappings: project.columnMappings,
          ruleConfigurations: project.ruleConfigurations
        })
        set({ busyAction: null, compilation })
      } catch (error) {
        set({ busyAction: null, error: errorMessage(error) })
      }
    },

    validateAndSaveRules: async () => {
      const project = get().currentProject
      if (!project || get().busyAction) return
      set({ busyAction: 'validating-rules', error: null, rulesSaveMessage: null })
      try {
        const result = await rulesService.validateAndSave(project, get().workbook)
        set({ busyAction: null, compilation: result.compilation, analysis: null, rowReview: null, analysisProgress: null, lastExportPath: null })
        if (!result.project) {
          set({ projectDirty: true, error: 'Resolve the invalid rules or column mappings, then Validate and Save again. Your edits have not been saved.' })
          return
        }
        set({
          currentProject: result.project,
          projects: replaceProject(get().projects, result.project),
          projectDirty: false,
          rulesSaveMessage: result.compilation.provider === 'laya' ? 'Validated and saved. Laya AI reviewed every enabled rule.' : 'Validated and saved.'
        })
      } catch (error) {
        set({ busyAction: null, error: errorMessage(error) })
      }
    },

    runAnalysis: async () => {
      const project = get().currentProject
      const workbook = get().workbook
      if (!project || !workbook || get().busyAction) return
      if (get().projectDirty) {
        await get().validateAndSaveRules()
        if (get().projectDirty || get().error) return
      }
      set({ busyAction: 'running-analysis', error: null, analysisProgress: null, lastExportPath: null })
      try {
        const analysis = await analysisService.run({
          projectId: project.id,
          sessionId: workbook.sessionId,
          sheetName: workbook.selectedSheet.name,
          rulesText: project.rulesText,
          disabledRuleIds: project.disabledRuleIds,
          ruleImpacts: project.ruleImpacts,
          columnMappings: project.columnMappings,
          ruleConfigurations: project.ruleConfigurations
        })
        const refreshedProject = await projectService.get(project.id)
        set({
          busyAction: null,
          analysis,
          rowReview: null,
          compilation: analysis.compilation,
          analysisProgress: { stage: 'finalize', percent: 100, message: 'Analysis complete.' },
          currentProject: refreshedProject,
          projects: replaceProject(get().projects, refreshedProject),
          projectDirty: false
        })
      } catch (error) {
        set({ busyAction: null, error: errorMessage(error) })
      }
    },

    setRowDecision: (analysisId, rowNumber, decision) => {
      const analysis = get().analysis
      if (get().busyAction || analysis?.id !== analysisId || !analysis.findings.some((finding) => finding.rowNumbers.includes(rowNumber))) return
      const current = get().rowReview
      const decisions = current?.analysisId === analysisId ? current.decisions : {}
      set({ rowReview: { analysisId, decisions: { ...decisions, [rowNumber]: decision } }, lastExportPath: null })
    },

    downloadCorrectedCsv: async () => {
      const analysis = get().analysis
      if (!analysis || get().busyAction) return
      const deletedRowNumbers = deletedRowsForReview(get().rowReview, analysis.id)
      set({ busyAction: 'exporting', error: null, lastExportPath: null })
      try {
        const lastExportPath = await findingsService.downloadCsv(analysis.id, deletedRowNumbers)
        set({ busyAction: null, lastExportPath })
      } catch (error) {
        set({ busyAction: null, error: errorMessage(error) })
      }
    },

    downloadReviewedWorkbook: async () => {
      const analysis = get().analysis
      if (!analysis || get().busyAction) return
      const acceptedRowNumbers = acceptedRowsForReview(get().rowReview, analysis.id)
      set({ busyAction: 'exporting', error: null, lastExportPath: null })
      try {
        const lastExportPath = await findingsService.downloadWorkbook(analysis.id, acceptedRowNumbers)
        set({ busyAction: null, lastExportPath })
      } catch (error) {
        set({ busyAction: null, error: errorMessage(error) })
      }
    },

    saveSettings: async (input) => {
      set({ busyAction: 'saving-settings', error: null, providerTestMessage: null })
      try {
        const settings = await settingsService.update(input)
        applyTheme()
        set({ busyAction: null, settings })
      } catch (error) {
        set({ busyAction: null, error: errorMessage(error) })
      }
    },

    testProvider: async () => {
      set({ busyAction: 'testing-provider', error: null, providerTestMessage: null })
      try {
        const result = await settingsService.testProvider()
        set({
          busyAction: null,
          providerTestMessage: result.latencyMs === undefined ? result.message : `${result.message} ${result.latencyMs} ms.`
        })
        if (!result.ok) set({ error: result.message })
      } catch (error) {
        set({ busyAction: null, error: errorMessage(error) })
      }
    }
  }
})
