import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'

import electronCommon from 'electron/common'
import electronMain from 'electron/main'

import { registerIpcHandlers } from './ipc/registerHandlers'
import { AnalysisService } from './services/analysisService'
import { AnomalyService } from './services/anomalyService'
import { CopilotService } from './services/copilotService'
import { ExportService } from './services/exportService'
import { NlpService } from './services/nlpService'
import { LayaService } from './services/layaService'
import { ProjectStore } from './services/projectStore'
import { ProjectDatasetService } from './services/projectDatasetService'
import { SettingsStore } from './services/settingsStore'
import { WorkbookService } from './services/workbookService'
import { verifyRuleExamples } from './smokeRuleExamples'

const { shell } = electronCommon
const { app, BrowserWindow, dialog } = electronMain

let mainWindow: Electron.BrowserWindow | null = null
const smokeTest = process.env.CATALOG_TRANSFORMER_SMOKE_TEST === '1'
if (smokeTest && process.env.CATALOG_TRANSFORMER_SMOKE_USER_DATA) app.setPath('userData', process.env.CATALOG_TRANSFORMER_SMOKE_USER_DATA)

function createWindow(): Electron.BrowserWindow {
  const window = new BrowserWindow({
    width: 1480,
    height: 940,
    minWidth: 1120,
    minHeight: 720,
    show: false,
    backgroundColor: '#F2F1EB',
    title: 'Catalog Transformer',
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: !smokeTest,
      spellcheck: true
    }
  })

  window.webContents.on('preload-error', (_event, preloadPath, error) => {
    console.error(`Preload failed at ${preloadPath}: ${error.message}`)
  })

  if (smokeTest) {
    window.webContents.once('did-finish-load', () => {
      setTimeout(() => {
        void window.webContents
          .executeJavaScript(
            `({
              ready: Boolean(document.querySelector('aside')) && document.body.innerText.includes('Catalog Transformer') && !document.body.innerText.includes('stopped unexpectedly'),
              hasApi: typeof window.catalogTransformer === 'object',
              text: document.body.innerText.slice(0, 800)
            })`
          )
          .then(async (state: { ready: boolean; hasApi: boolean; text: string }) => {
            if (!state.ready) {
              throw new Error(`The initialized React application shell was not detected. API=${state.hasApi}. Body=${JSON.stringify(state.text)}`)
            }
            if (process.env.CATALOG_TRANSFORMER_SMOKE_USER_DATA) await verifyRuleExamples(window, process.env.CATALOG_TRANSFORMER_SMOKE_SCREENSHOT)
            if (process.env.CATALOG_TRANSFORMER_SMOKE_EXPECT_LAYA === '1') {
              const layaStatus = await window.webContents.executeJavaScript('window.catalogTransformer.getCopilotStatus()') as { laya: string; layaDetail: string }
              if (layaStatus.laya !== 'ready') throw new Error(`Packaged Laya model did not load: ${layaStatus.layaDetail}`)
              const validation = await window.webContents.executeJavaScript('window.catalogTransformer.testProvider()') as { ok: boolean; message: string }
              if (!validation.ok) throw new Error(`Packaged Laya rule validation failed: ${validation.message}`)
            }
            if (process.env.CATALOG_TRANSFORMER_SMOKE_SCREENSHOT) {
              const image = await window.capturePage()
              await writeFile(process.env.CATALOG_TRANSFORMER_SMOKE_SCREENSHOT, image.toPNG())
            }
            console.log('CATALOG_TRANSFORMER_SMOKE_OK')
            app.exit(0)
          })
          .catch((error: unknown) => {
            console.error(`CATALOG_TRANSFORMER_SMOKE_FAILED: ${error instanceof Error ? error.message : 'renderer verification failed'}`)
            app.exit(1)
          })
      }, 2_500)
    })
    window.webContents.once('did-fail-load', (_event, errorCode, errorDescription) => {
      console.error(`CATALOG_TRANSFORMER_SMOKE_FAILED ${errorCode}: ${errorDescription}`)
      app.exit(1)
    })
  } else {
    window.once('ready-to-show', () => window.show())
  }
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) void shell.openExternal(url)
    return { action: 'deny' }
  })
  window.webContents.on('will-navigate', (event) => event.preventDefault())

  const rendererUrl = process.env.ELECTRON_RENDERER_URL
  if (rendererUrl) void window.loadURL(rendererUrl)
  else void window.loadFile(join(__dirname, '../renderer/index.html'))

  return window
}

async function bootstrap(): Promise<void> {
  const userDataPath = app.getPath('userData')
  const projects = new ProjectStore(userDataPath)
  const settings = new SettingsStore(userDataPath)
  const workbooks = new WorkbookService()
  const laya = new LayaService(userDataPath, join(app.getAppPath(), 'models', 'laya-multilingual'))
  const nlp = new NlpService(laya)
  const analysis = new AnalysisService(workbooks, projects, nlp)
  const copilot = new CopilotService(analysis, settings, userDataPath, workbooks, laya)
  const exports = new ExportService(analysis)
  const datasets = new ProjectDatasetService(projects, workbooks)
  const anomalies = new AnomalyService(workbooks, laya)

  await projects.initialize()
  if (smokeTest && process.env.CATALOG_TRANSFORMER_SMOKE_USER_DATA) await projects.create({ name: 'Rule input smoke test' })
  registerIpcHandlers({ projects, settings, analysis, copilot, exports, nlp, datasets, anomalies })
  mainWindow = createWindow()
  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.setAppUserModelId('com.aidyn.catalogtransformer')

void app.whenReady().then(bootstrap).catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'The application could not start.'
  if (!smokeTest) dialog.showErrorBox('Catalog Transformer startup failed', message)
  else console.error(`CATALOG_TRANSFORMER_SMOKE_FAILED: ${message}`)
  if (smokeTest) app.exit(1)
  else app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) mainWindow = createWindow()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
