import type {
  AnalysisProgress,
  AnalysisRequest,
  AnalysisResult,
  AppSettings,
  CompilationResult,
  CreateProjectInput,
  FindingSourceRows,
  InterpretationPreviewRequest,
  ProjectRecord,
  ProjectDataset,
  UpdateProjectInput,
  UpdateProjectDetailsInput,
  UpdateSettingsInput,
  WorkbookProfile,
} from '../index'
import type { CopilotGuidance } from '../copilot/guidance'
import type { CoverageCandidate } from '../copilot/coverage'

export type { CopilotGuidance } from '../copilot/guidance'

export interface CopilotStatus {
  status: 'available' | 'unavailable'
  detail: string
  laya: 'ready' | 'unavailable'
  layaDetail: string
}

export interface CopilotAnswer {
  source: 'ai'
  answer: string
  model: string
}

export interface CopilotCoverage {
  candidates: CoverageCandidate[]
  suggestedId: string | null
  source: 'laya' | 'local' | 'needs_review'
}

export interface CopilotRowContext {
  columns: Array<{ key: string; header: string }>
  rows: Array<{ rowNumber: number; values: Record<string, string> }>
}

export const IPC_CHANNELS = {
  appVersion: 'app:version',
  projectsList: 'projects:list',
  projectsCreate: 'projects:create',
  projectsGet: 'projects:get',
  projectsUpdate: 'projects:update',
  projectsUpdateDetails: 'projects:update-details',
  projectsDelete: 'projects:delete',
  workbookChoose: 'workbook:choose',
  workbookInspectPath: 'workbook:inspect-path',
  projectWorkbook: 'projects:workbook',
  rulesInterpret: 'rules:interpret',
  analysisRun: 'analysis:run',
  analysisProgress: 'analysis:progress',
  findingRows: 'findings:rows',
  copilotGuide: 'copilot:guide',
  copilotCoverage: 'copilot:coverage',
  copilotAsk: 'copilot:ask',
  copilotStatus: 'copilot:status',
  copilotRows: 'copilot:rows',
  downloadCorrectedCsv: 'findings:download-csv',
  downloadReviewedWorkbook: 'findings:download-workbook',
  anomalyDetect: 'anomaly:detect',
  settingsGet: 'settings:get',
  settingsUpdate: 'settings:update',
  settingsTestProvider: 'settings:test-provider'
} as const

export interface ProviderTestResult {
  ok: boolean
  message: string
  latencyMs?: number
}

export interface CatalogTransformerApi {
  getAppVersion(): Promise<string>
  listProjects(): Promise<ProjectRecord[]>
  createProject(input: CreateProjectInput): Promise<ProjectRecord>
  getProject(projectId: string): Promise<ProjectRecord>
  updateProject(input: UpdateProjectInput): Promise<ProjectRecord>
  updateProjectDetails(input: UpdateProjectDetailsInput): Promise<ProjectRecord>
  deleteProject(projectId: string): Promise<void>
  chooseWorkbook(projectId: string): Promise<ProjectDataset | null>
  inspectWorkbookPath(projectId: string, filePath: string): Promise<ProjectDataset>
  getProjectWorkbook(projectId: string): Promise<WorkbookProfile | null>
  getPathForDroppedFile(file: File): string
  interpretRules(input: InterpretationPreviewRequest): Promise<CompilationResult>
  runAnalysis(input: AnalysisRequest): Promise<AnalysisResult>
  getFindingRows(analysisId: string, findingId: string, offset?: number): Promise<FindingSourceRows>
  onAnalysisProgress(callback: (progress: AnalysisProgress) => void): () => void
  getCopilotStatus(): Promise<CopilotStatus>
  guideFinding(analysisId: string, findingId: string): Promise<CopilotGuidance>
  reviewCoverage(analysisId: string): Promise<CopilotCoverage>
  getCopilotRows(analysisId: string, findingId: string, columnKeys: string[]): Promise<CopilotRowContext>
  askFinding(analysisId: string, findingId: string, question: string): Promise<CopilotAnswer>
  downloadCorrectedCsv(analysisId: string, deletedRowNumbers: number[]): Promise<string | null>
  downloadReviewedWorkbook(analysisId: string, acceptedRowNumbers: number[]): Promise<string | null>
  detectAnomalies(sessionId: string, sheetName: string): Promise<import('../anomaly/types').AnomalyScanResult>
  getSettings(): Promise<AppSettings>
  updateSettings(input: UpdateSettingsInput): Promise<AppSettings>
  testProvider(): Promise<ProviderTestResult>
}
