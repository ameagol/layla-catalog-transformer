import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { updateSettingsInputSchema } from '../src/core/ipc/schemas'
import { DEFAULT_SETTINGS } from '../src/core/model/defaults'
import { SettingsStore } from '../src/main/services/settingsStore'
import { applyTheme } from '../src/renderer/src/styles/theme'

vi.mock('electron/main', () => ({ default: { safeStorage: {} } }))
const directories: string[] = []

afterEach(async () => {
  vi.unstubAllGlobals()
  for (const directory of directories.splice(0)) {
    expect(resolve(directory).startsWith(join(tmpdir(), 'catalog-light-theme-'))).toBe(true)
    await rm(directory, { recursive: true, force: true })
  }
})

describe('light-only settings', () => {
  it('loads legacy dark preferences as light without resetting provider configuration', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'catalog-light-theme-'))
    directories.push(directory)
    await mkdir(join(directory, 'settings'))
    const settingsPath = join(directory, 'settings', 'settings.json')
    await writeFile(settingsPath, JSON.stringify({ ...DEFAULT_SETTINGS, theme: 'dark', defaultPersistAnalysisResults: true, provider: { ...DEFAULT_SETTINGS.provider, model: 'Existing model' } }))
    const store = new SettingsStore(directory)
    const settings = await store.get()
    expect(settings).toMatchObject({ theme: 'light', provider: { model: 'Existing model' }, defaultPersistAnalysisResults: true })
    await store.update(updateSettingsInputSchema.parse(settings))
    expect(JSON.parse(await readFile(settingsPath, 'utf8')).theme).toBe('light')
  })

  it('accepts only light settings and ignores the operating-system color scheme', () => {
    expect(updateSettingsInputSchema.safeParse({ ...DEFAULT_SETTINGS, theme: 'dark' }).success).toBe(false)
    expect(updateSettingsInputSchema.safeParse({ ...DEFAULT_SETTINGS, theme: 'system' }).success).toBe(false)
    const matchMedia = vi.fn(() => ({ matches: true }))
    vi.stubGlobal('window', { matchMedia })
    vi.stubGlobal('document', { documentElement: { dataset: { theme: 'dark' } } })
    applyTheme()
    expect(document.documentElement.dataset.theme).toBe('light')
    expect(matchMedia).not.toHaveBeenCalled()
  })
})
