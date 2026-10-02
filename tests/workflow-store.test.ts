import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { DEFAULT_SETTINGS } from '../src/core/model/defaults'
import { useAppStore } from '../src/renderer/src/stores/useAppStore'
import { workflowAnalysis, workflowCompilation, workflowProject, workflowWorkbook } from './workflow-fixtures'

const initialState = useAppStore.getState()
const project = workflowProject()
const workbook = workflowWorkbook()
const storage = new Map<string, string>()
const api = {
  getAppVersion: vi.fn(), listProjects: vi.fn(), getProject: vi.fn(), getProjectWorkbook: vi.fn(),
  chooseWorkbook: vi.fn(), inspectWorkbookPath: vi.fn(), getPathForDroppedFile: vi.fn(),
  updateProject: vi.fn(), updateProjectDetails: vi.fn(), createProject: vi.fn(), deleteProject: vi.fn(), downloadCorrectedCsv: vi.fn(),
  interpretRules: vi.fn(), getSettings: vi.fn(), onAnalysisProgress: vi.fn(), runAnalysis: vi.fn(), downloadReviewedWorkbook: vi.fn()
}

beforeEach(() => {
  vi.resetAllMocks()
  storage.clear()
  vi.stubGlobal('window', {
    catalogTransformer: api,
    localStorage: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key)
    }
  })
  vi.stubGlobal('document', { documentElement: { dataset: {} } })
  api.getProject.mockResolvedValue(project)
  api.getProjectWorkbook.mockResolvedValue(workbook)
  api.interpretRules.mockResolvedValue(workflowCompilation())
  api.updateProject.mockImplementation(async (input) => ({ ...project, ...input }))
  api.updateProjectDetails.mockImplementation(async (input) => ({ ...project, ...input }))
  api.onAnalysisProgress.mockReturnValue(() => undefined)
  api.listProjects.mockResolvedValue([project])
  api.getSettings.mockResolvedValue(DEFAULT_SETTINGS)
  api.getAppVersion.mockResolvedValue('0.1.0')
  useAppStore.setState({ ...initialState, initialized: true, currentProject: project, projects: [project], workbook }, true)
})

afterEach(() => vi.unstubAllGlobals())

describe('project workbook state', () => {
  it('restores the active project workbook at startup and discards a removed saved selection', async () => {
    useAppStore.setState({ ...initialState }, true)
    storage.set('catalog-transformer:project-id', 'removed-project')
    await useAppStore.getState().initialize()
    expect(api.getProjectWorkbook).toHaveBeenCalledWith(project.id)
    expect(useAppStore.getState()).toMatchObject({ initialized: true, currentProject: project, workbook, busyAction: null })
    expect(storage.get('catalog-transformer:project-id')).toBe(project.id)
  })

  it('has no active project or stale selection on an empty install', async () => {
    useAppStore.setState({ ...initialState }, true)
    storage.set('catalog-transformer:project-id', 'removed-project')
    api.listProjects.mockResolvedValue([])
    await useAppStore.getState().initialize()
    expect(useAppStore.getState().currentProject).toBeNull()
    expect(storage.has('catalog-transformer:project-id')).toBe(false)
    expect(api.getProjectWorkbook).not.toHaveBeenCalled()
  })

  it('never shows the old workbook when changing projects, even if the new file is unavailable', async () => {
    const next = workflowProject({ id: '00000000-0000-4000-8000-000000000103', name: 'Next' })
    api.getProject.mockResolvedValue(next)
    api.getProjectWorkbook.mockRejectedValue(new Error('Workbook is unavailable'))
    await useAppStore.getState().selectProject(next.id)
    expect(useAppStore.getState()).toMatchObject({ currentProject: next, workbook: null, compilation: null, analysis: null, error: 'Workbook is unavailable', busyAction: null })
  })

  it('preserves the current workbook and findings when file selection is canceled', async () => {
    const compilation = workflowCompilation()
    useAppStore.setState({ compilation })
    api.chooseWorkbook.mockResolvedValue(null)
    await useAppStore.getState().chooseWorkbook()
    expect(api.chooseWorkbook).toHaveBeenCalledWith(project.id)
    expect(useAppStore.getState()).toMatchObject({ workbook, compilation, busyAction: null })
    expect(api.interpretRules).not.toHaveBeenCalled()
  })

  it('attaches a replacement without silently saving or discarding unsaved rule edits', async () => {
    const draft = { ...project, rulesText: 'Flag rows with a missing phone.' }
    const replacement = workflowWorkbook({ fileName: 'replacement.xlsx' })
    api.chooseWorkbook.mockResolvedValue({ project: { ...project, sourceFilePath: 'C:\\replacement.xlsx', columnMappings: {} }, workbook: replacement })
    useAppStore.setState({ currentProject: draft, projectDirty: true })
    await useAppStore.getState().chooseWorkbook()
    expect(useAppStore.getState().currentProject).toMatchObject({ rulesText: draft.rulesText, sourceFilePath: 'C:\\replacement.xlsx' })
    expect(useAppStore.getState()).toMatchObject({ workbook: replacement, projectDirty: true, analysis: null })
    expect(api.updateProject).not.toHaveBeenCalled()
  })

  it('requires a project before loading a file and reports creation errors to the form', async () => {
    useAppStore.setState({ currentProject: null })
    await useAppStore.getState().chooseWorkbook()
    expect(api.chooseWorkbook).not.toHaveBeenCalled()
    api.createProject.mockRejectedValue(new Error('Could not save project'))
    expect(await useAppStore.getState().createProject({ name: 'New' })).toBe(false)
    expect(useAppStore.getState().error).toBe('Could not save project')
  })

  it('clears workbook, findings and saved selection when deleting the last project', async () => {
    storage.set('catalog-transformer:project-id', project.id)
    api.deleteProject.mockResolvedValue(undefined)
    await useAppStore.getState().deleteProject(project.id)
    expect(useAppStore.getState()).toMatchObject({ projects: [], currentProject: null, workbook: null, analysis: null, compilation: null })
    expect(storage.has('catalog-transformer:project-id')).toBe(false)
  })
})

describe('combined rule workflow state', () => {
  it('updates compilation and saved state only after interpretation and persistence succeed', async () => {
    useAppStore.setState({ projectDirty: true })
    await useAppStore.getState().validateAndSaveRules()
    expect(api.updateProject).toHaveBeenCalledOnce()
    expect(useAppStore.getState()).toMatchObject({ projectDirty: false, compilation: workflowCompilation(), rulesSaveMessage: 'Validated and saved.', busyAction: null })
  })

  it('retains mapping choices and shows invalid feedback without claiming a successful save', async () => {
    const draft = workflowProject({ rulesText: 'Predict future demand with magic.', columnMappings: { email: 'email' } })
    api.interpretRules.mockResolvedValue(workflowCompilation(draft.rulesText))
    useAppStore.setState({ currentProject: draft, projectDirty: true })
    await useAppStore.getState().validateAndSaveRules()
    expect(api.updateProject).not.toHaveBeenCalled()
    expect(useAppStore.getState()).toMatchObject({ currentProject: draft, projectDirty: true, rulesSaveMessage: null, busyAction: null })
    expect(useAppStore.getState().error).toContain('not been saved')
  })

  it('keeps the draft dirty after a persistence failure and allows a retry', async () => {
    useAppStore.setState({ projectDirty: true })
    api.updateProject.mockRejectedValueOnce(new Error('Disk full'))
    await useAppStore.getState().validateAndSaveRules()
    expect(useAppStore.getState()).toMatchObject({ projectDirty: true, error: 'Disk full', rulesSaveMessage: null, busyAction: null })
    await useAppStore.getState().validateAndSaveRules()
    expect(useAppStore.getState()).toMatchObject({ projectDirty: false, error: null, rulesSaveMessage: 'Validated and saved.' })
  })

  it('keeps interpretation available while a mapping is edited, then validates that mapping', async () => {
    const compilation = workflowCompilation()
    useAppStore.setState({ compilation })
    useAppStore.getState().setColumnMapping('email', 'email')
    expect(useAppStore.getState()).toMatchObject({ compilation, projectDirty: true, currentProject: { columnMappings: { email: 'email' } } })
    await useAppStore.getState().validateAndSaveRules()
    expect(api.interpretRules).toHaveBeenCalledWith(expect.objectContaining({ columnMappings: { email: 'email' } }))
    expect(api.updateProject).toHaveBeenCalledWith(expect.objectContaining({ columnMappings: { email: 'email' } }))
  })

  it('invalidates stale interpretation when source changes and blocks running an invalid draft', async () => {
    useAppStore.setState({ compilation: workflowCompilation() })
    useAppStore.getState().updateProjectDraft({ rulesText: 'Predict future demand with magic.' })
    expect(useAppStore.getState().compilation).toBeNull()
    api.interpretRules.mockResolvedValue(workflowCompilation('Predict future demand with magic.'))
    await useAppStore.getState().runAnalysis()
    expect(api.runAnalysis).not.toHaveBeenCalled()
    expect(api.updateProject).not.toHaveBeenCalled()
  })

  it('saves Impact with the combined action and invalidates old findings and decisions', async () => {
    const compilation = workflowCompilation()
    const ruleId = compilation.interpretations[0]!.id
    const analysis = workflowAnalysis()
    useAppStore.setState({ compilation, analysis, rowReview: { analysisId: analysis.id, decisions: { 2: 'delete' } } })
    useAppStore.getState().setRuleImpact(ruleId, 'large')
    expect(useAppStore.getState()).toMatchObject({ compilation, projectDirty: true, analysis: null, rowReview: null })
    await useAppStore.getState().validateAndSaveRules()
    expect(api.updateProject).toHaveBeenCalledWith(expect.objectContaining({ ruleImpacts: { [ruleId]: 'large' } }))
    expect(useAppStore.getState().currentProject?.ruleImpacts[ruleId]).toBe('large')
  })
})

describe('project detail editing', () => {
  it('renames the selected project without creating another project or saving unsaved rules', async () => {
    useAppStore.setState({ currentProject: { ...project, rulesText: 'Unvalidated draft' }, projectDirty: true })
    const details = { id: project.id, name: 'Renamed project', description: 'Updated description' }
    expect(await useAppStore.getState().saveProjectDetails(details)).toBe(true)
    expect(api.updateProjectDetails).toHaveBeenCalledWith(details)
    expect(api.createProject).not.toHaveBeenCalled()
    expect(api.updateProject).not.toHaveBeenCalled()
    expect(useAppStore.getState().currentProject).toMatchObject({ ...details, rulesText: 'Unvalidated draft' })
    expect(useAppStore.getState().projects[0]).toMatchObject({ ...details, rulesText: project.rulesText })
    expect(useAppStore.getState().projectDirty).toBe(true)
  })

  it('preserves project data and reports a failed rename for retry', async () => {
    api.updateProjectDetails.mockRejectedValueOnce(new Error('Disk full'))
    const details = { id: project.id, name: 'Renamed', description: '' }
    expect(await useAppStore.getState().saveProjectDetails(details)).toBe(false)
    expect(useAppStore.getState()).toMatchObject({ currentProject: project, error: 'Disk full', busyAction: null })
    expect(await useAppStore.getState().saveProjectDetails(details)).toBe(true)
    expect(useAppStore.getState().currentProject?.name).toBe('Renamed')
  })
})

describe('finding row decisions', () => {
  it('sends only explicitly accepted rows to the Excel download and keeps decisions on cancellation', async () => {
    const analysis = workflowAnalysis()
    useAppStore.setState({ analysis })
    useAppStore.getState().setRowDecision(analysis.id, 2, 'delete')
    useAppStore.getState().setRowDecision(analysis.id, 204, 'accept')
    api.downloadReviewedWorkbook.mockResolvedValueOnce(null).mockResolvedValueOnce('reviewed.xlsx')
    await useAppStore.getState().downloadReviewedWorkbook()
    expect(api.downloadReviewedWorkbook).toHaveBeenCalledWith(analysis.id, [204])
    expect(useAppStore.getState().rowReview?.decisions).toEqual({ 2: 'delete', 204: 'accept' })
    await useAppStore.getState().downloadReviewedWorkbook()
    expect(useAppStore.getState().lastExportPath).toBe('reviewed.xlsx')
    expect(analysis.findings[0]?.rowNumbers).toEqual([2, 204])
  })

  it('clears stale findings and acceptance when priority or action policy changes, then passes policy to validation', async () => {
    const analysis = workflowAnalysis()
    useAppStore.setState({ analysis, rowReview: { analysisId: analysis.id, decisions: { 2: 'accept' } } })
    useAppStore.getState().setRuleConfiguration('rule-1-test', { priority: 'high', actionItem: 'Route to the Data Steward.' })
    expect(useAppStore.getState()).toMatchObject({ analysis: null, rowReview: null, projectDirty: true })
    await useAppStore.getState().validateAndSaveRules()
    expect(api.interpretRules).toHaveBeenCalledWith(expect.objectContaining({ ruleConfigurations: { 'rule-1-test': { priority: 'high', actionItem: 'Route to the Data Steward.' } } }))
    expect(api.updateProject).toHaveBeenCalledWith(expect.objectContaining({ ruleConfigurations: { 'rule-1-test': { priority: 'high', actionItem: 'Route to the Data Steward.' } } }))
  })
  it('shares decisions for each source row and downloads only exclusions', async () => {
    const analysis = workflowAnalysis()
    useAppStore.setState({ analysis })
    useAppStore.getState().setRowDecision(analysis.id, 2, 'delete')
    useAppStore.getState().setRowDecision(analysis.id, 204, 'accept')
    api.downloadCorrectedCsv.mockResolvedValue('C:\\download\\fixed.csv')
    await useAppStore.getState().downloadCorrectedCsv()
    expect(api.downloadCorrectedCsv).toHaveBeenCalledWith(analysis.id, [2])
    expect(useAppStore.getState().lastExportPath).toBe('C:\\download\\fixed.csv')
    useAppStore.getState().setRowDecision(analysis.id, 2, 'accept')
    expect(useAppStore.getState().lastExportPath).toBeNull()
    await useAppStore.getState().downloadCorrectedCsv()
    expect(api.downloadCorrectedCsv).toHaveBeenLastCalledWith(analysis.id, [])
    expect(analysis.findings[0]?.rowNumbers).toEqual([2, 204])
  })

  it('ignores unrelated rows, old analysis IDs and clicks during an operation', () => {
    const analysis = workflowAnalysis()
    useAppStore.setState({ analysis })
    useAppStore.getState().setRowDecision('old-analysis', 2, 'delete')
    useAppStore.getState().setRowDecision(analysis.id, 999, 'delete')
    useAppStore.setState({ busyAction: 'exporting' })
    useAppStore.getState().setRowDecision(analysis.id, 2, 'delete')
    expect(useAppStore.getState().rowReview).toBeNull()
  })

  it('keeps decisions after cancellation or failure and permits a retry', async () => {
    const analysis = workflowAnalysis()
    useAppStore.setState({ analysis })
    useAppStore.getState().setRowDecision(analysis.id, 204, 'delete')
    api.downloadCorrectedCsv.mockResolvedValueOnce(null).mockRejectedValueOnce(new Error('Access denied')).mockResolvedValueOnce('fixed.csv')
    await useAppStore.getState().downloadCorrectedCsv()
    expect(useAppStore.getState()).toMatchObject({ lastExportPath: null, error: null, busyAction: null })
    await useAppStore.getState().downloadCorrectedCsv()
    expect(useAppStore.getState()).toMatchObject({ lastExportPath: null, error: 'Access denied', busyAction: null })
    await useAppStore.getState().downloadCorrectedCsv()
    expect(api.downloadCorrectedCsv).toHaveBeenLastCalledWith(analysis.id, [204])
    expect(useAppStore.getState()).toMatchObject({ lastExportPath: 'fixed.csv', error: null })
  })

  it('does not carry deletions into a new analysis', async () => {
    const analysis = workflowAnalysis()
    useAppStore.setState({ analysis, rowReview: { analysisId: analysis.id, decisions: { 2: 'delete' } } })
    api.runAnalysis.mockResolvedValue(workflowAnalysis({ id: '00000000-0000-4000-8000-000000000105' }))
    await useAppStore.getState().runAnalysis()
    expect(useAppStore.getState().rowReview).toBeNull()
    expect(useAppStore.getState().analysis?.id).not.toBe(analysis.id)
  })

  it('allows downloading a clean dataset with no findings', async () => {
    const analysis = workflowAnalysis({ findings: [] })
    useAppStore.setState({ analysis })
    api.downloadCorrectedCsv.mockResolvedValue('clean.csv')
    await useAppStore.getState().downloadCorrectedCsv()
    expect(api.downloadCorrectedCsv).toHaveBeenCalledWith(analysis.id, [])
  })
})
