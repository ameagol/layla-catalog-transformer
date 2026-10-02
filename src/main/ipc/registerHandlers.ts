import electronMain from 'electron/main'

import { IPC_CHANNELS } from '@core/ipc/contracts'
import {
  analysisInputSchema,
  copilotAskInputSchema,
  copilotGuideInputSchema,
  copilotRowsInputSchema,
  createProjectInputSchema,
  correctedCsvInputSchema,
  reviewedWorkbookInputSchema,
  findingRowsInputSchema,
  interpretationPreviewInputSchema,
  projectIdSchema,
  updateProjectInputSchema,
  updateProjectDetailsInputSchema,
  updateSettingsInputSchema,
  workbookPathSchema
} from '@core/ipc/schemas'

import { AnalysisService } from '../services/analysisService'
import { CopilotService } from '../services/copilotService'
import { ExportService } from '../services/exportService'
import { NlpService } from '../services/nlpService'
import { ProjectStore } from '../services/projectStore'
import { ProjectDatasetService } from '../services/projectDatasetService'
import { SettingsStore } from '../services/settingsStore'

interface HandlerServices {
  projects: ProjectStore
  settings: SettingsStore
  analysis: AnalysisService
  copilot: CopilotService
  exports: ExportService
  nlp: NlpService
  datasets: ProjectDatasetService
}

const { app, BrowserWindow, ipcMain } = electronMain

function senderWindow(event: Electron.IpcMainInvokeEvent): Electron.BrowserWindow {
  const window = BrowserWindow.fromWebContents(event.sender)
  if (!window) throw new Error('The application window is no longer available.')
  return window
}

export function registerIpcHandlers(services: HandlerServices): void {
  ipcMain.handle(IPC_CHANNELS.appVersion, () => app.getVersion())
  ipcMain.handle(IPC_CHANNELS.projectsList, () => services.projects.list())
  ipcMain.handle(IPC_CHANNELS.projectsCreate, async (_event, input: unknown) => {
    const parsed = createProjectInputSchema.parse(input)
    const settings = await services.settings.get()
    return services.projects.create(parsed, settings.defaultPersistAnalysisResults)
  })
  ipcMain.handle(IPC_CHANNELS.projectsGet, (_event, projectId: unknown) =>
    services.projects.get(projectIdSchema.parse(projectId))
  )
  ipcMain.handle(IPC_CHANNELS.projectsUpdate, (_event, input: unknown) =>
    services.projects.update(updateProjectInputSchema.parse(input))
  )
  ipcMain.handle(IPC_CHANNELS.projectsUpdateDetails, (_event, input: unknown) =>
    services.projects.updateDetails(updateProjectDetailsInputSchema.parse(input))
  )
  ipcMain.handle(IPC_CHANNELS.projectsDelete, (_event, projectId: unknown) =>
    services.projects.delete(projectIdSchema.parse(projectId))
  )
  ipcMain.handle(IPC_CHANNELS.workbookChoose, (event, projectId: unknown) =>
    services.datasets.choose(projectIdSchema.parse(projectId), senderWindow(event))
  )
  ipcMain.handle(IPC_CHANNELS.workbookInspectPath, (_event, input: unknown) => {
    const parsed = workbookPathSchema.parse(input)
    return services.datasets.inspect(parsed.projectId, parsed.filePath)
  })
  ipcMain.handle(IPC_CHANNELS.projectWorkbook, (_event, projectId: unknown) =>
    services.datasets.open(projectIdSchema.parse(projectId))
  )
  ipcMain.handle(IPC_CHANNELS.rulesInterpret, (_event, input: unknown) =>
    services.analysis.preview(interpretationPreviewInputSchema.parse(input))
  )
  ipcMain.handle(IPC_CHANNELS.analysisRun, async (event, input: unknown) => {
    const parsed = analysisInputSchema.parse(input)
    return services.analysis.run(parsed, (progress) => {
      if (!event.sender.isDestroyed()) event.sender.send(IPC_CHANNELS.analysisProgress, progress)
    })
  })
  ipcMain.handle(IPC_CHANNELS.findingRows, (_event, input: unknown) => {
    const parsed = findingRowsInputSchema.parse(input)
    return services.analysis.getFindingRows(parsed.analysisId, parsed.findingId, parsed.offset)
  })
  ipcMain.handle(IPC_CHANNELS.copilotStatus, () => services.copilot.status())
  ipcMain.handle(IPC_CHANNELS.copilotGuide, (_event, input: unknown) => {
    const parsed = copilotGuideInputSchema.parse(input)
    return services.copilot.guide(parsed.analysisId, parsed.findingId)
  })
  ipcMain.handle(IPC_CHANNELS.copilotCoverage, (_event, analysisId: unknown) =>
    services.copilot.coverage(projectIdSchema.parse(analysisId))
  )
  ipcMain.handle(IPC_CHANNELS.copilotRows, (_event, input: unknown) => {
    const parsed = copilotRowsInputSchema.parse(input)
    return services.copilot.rows(parsed.analysisId, parsed.findingId, parsed.columnKeys)
  })
  ipcMain.handle(IPC_CHANNELS.copilotAsk, (_event, input: unknown) => {
    const parsed = copilotAskInputSchema.parse(input)
    return services.copilot.ask(parsed.analysisId, parsed.findingId, parsed.question)
  })
  ipcMain.handle(IPC_CHANNELS.downloadCorrectedCsv, (event, input: unknown) => {
    const parsed = correctedCsvInputSchema.parse(input)
    return services.exports.downloadCsv(senderWindow(event), parsed)
  })
  ipcMain.handle(IPC_CHANNELS.downloadReviewedWorkbook, (event, input: unknown) =>
    services.exports.downloadWorkbook(senderWindow(event), reviewedWorkbookInputSchema.parse(input))
  )
  ipcMain.handle(IPC_CHANNELS.settingsGet, () => services.settings.get())
  ipcMain.handle(IPC_CHANNELS.settingsUpdate, (_event, input: unknown) =>
    services.settings.update(updateSettingsInputSchema.parse(input))
  )
  ipcMain.handle(IPC_CHANNELS.settingsTestProvider, () => services.nlp.testProvider())
}
