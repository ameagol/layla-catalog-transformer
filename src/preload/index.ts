import electronRenderer from 'electron/renderer'

import type { AnalysisProgress, CatalogTransformerApi } from '@core/index'
import { IPC_CHANNELS } from '@core/ipc/contracts'

const { contextBridge, ipcRenderer, webUtils } = electronRenderer

const api: CatalogTransformerApi = {
  getAppVersion: () => ipcRenderer.invoke(IPC_CHANNELS.appVersion),
  listProjects: () => ipcRenderer.invoke(IPC_CHANNELS.projectsList),
  createProject: (input) => ipcRenderer.invoke(IPC_CHANNELS.projectsCreate, input),
  getProject: (projectId) => ipcRenderer.invoke(IPC_CHANNELS.projectsGet, projectId),
  updateProject: (input) => ipcRenderer.invoke(IPC_CHANNELS.projectsUpdate, input),
  updateProjectDetails: (input) => ipcRenderer.invoke(IPC_CHANNELS.projectsUpdateDetails, input),
  deleteProject: (projectId) => ipcRenderer.invoke(IPC_CHANNELS.projectsDelete, projectId),
  chooseWorkbook: (projectId) => ipcRenderer.invoke(IPC_CHANNELS.workbookChoose, projectId),
  inspectWorkbookPath: (projectId, filePath) => ipcRenderer.invoke(IPC_CHANNELS.workbookInspectPath, { projectId, filePath }),
  getProjectWorkbook: (projectId) => ipcRenderer.invoke(IPC_CHANNELS.projectWorkbook, projectId),
  getPathForDroppedFile: (file) => webUtils.getPathForFile(file),
  interpretRules: (input) => ipcRenderer.invoke(IPC_CHANNELS.rulesInterpret, input),
  runAnalysis: (input) => ipcRenderer.invoke(IPC_CHANNELS.analysisRun, input),
  getFindingRows: (analysisId, findingId, offset = 0) =>
    ipcRenderer.invoke(IPC_CHANNELS.findingRows, { analysisId, findingId, offset }),
  onAnalysisProgress: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, progress: AnalysisProgress): void => callback(progress)
    ipcRenderer.on(IPC_CHANNELS.analysisProgress, listener)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.analysisProgress, listener)
  },
  getCopilotStatus: () => ipcRenderer.invoke(IPC_CHANNELS.copilotStatus),
  guideFinding: (analysisId, findingId) =>
    ipcRenderer.invoke(IPC_CHANNELS.copilotGuide, { analysisId, findingId }),
  reviewCoverage: (analysisId) => ipcRenderer.invoke(IPC_CHANNELS.copilotCoverage, { analysisId }),
  getCopilotRows: (analysisId, findingId, columnKeys) =>
    ipcRenderer.invoke(IPC_CHANNELS.copilotRows, { analysisId, findingId, columnKeys }),
  askFinding: (analysisId, findingId, question) =>
    ipcRenderer.invoke(IPC_CHANNELS.copilotAsk, { analysisId, findingId, question }),
  downloadCorrectedCsv: (analysisId, deletedRowNumbers) =>
    ipcRenderer.invoke(IPC_CHANNELS.downloadCorrectedCsv, { analysisId, deletedRowNumbers }),
  downloadReviewedWorkbook: (analysisId, acceptedRowNumbers) =>
    ipcRenderer.invoke(IPC_CHANNELS.downloadReviewedWorkbook, { analysisId, acceptedRowNumbers }),
  getSettings: () => ipcRenderer.invoke(IPC_CHANNELS.settingsGet),
  updateSettings: (input) => ipcRenderer.invoke(IPC_CHANNELS.settingsUpdate, input),
  testProvider: () => ipcRenderer.invoke(IPC_CHANNELS.settingsTestProvider)
}

contextBridge.exposeInMainWorld('catalogTransformer', api)
