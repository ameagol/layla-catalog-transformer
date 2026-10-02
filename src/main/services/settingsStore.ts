import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

import electronMain from 'electron/main'

import type { AppSettings, UpdateSettingsInput } from '@core/model/domain'
import { DEFAULT_SETTINGS } from '@core/model/defaults'

import { readJsonFile, writeJsonAtomic } from './fileStore'

const { safeStorage } = electronMain

export class SettingsStore {
  private readonly settingsDirectory: string
  private readonly settingsPath: string
  private readonly secretPath: string
  private readonly copilotSecretPath: string

  constructor(userDataPath: string) {
    this.settingsDirectory = join(userDataPath, 'settings')
    this.settingsPath = join(this.settingsDirectory, 'settings.json')
    this.secretPath = join(this.settingsDirectory, 'provider-secret.bin')
    this.copilotSecretPath = join(this.settingsDirectory, 'copilot-secret.bin')
  }

  async get(): Promise<AppSettings> {
    await mkdir(this.settingsDirectory, { recursive: true })
    let stored: Partial<AppSettings> = {}
    try {
      stored = await readJsonFile<Partial<AppSettings>>(this.settingsPath)
    } catch {
      stored = {}
    }
    const apiKeyConfigured = await readFile(this.secretPath).then(() => true).catch(() => false)
    const copilotKeyConfigured = await readFile(this.copilotSecretPath).then(() => true).catch(() => false)
    return {
      ...DEFAULT_SETTINGS,
      ...stored,
      theme: 'light',
      provider: {
        ...DEFAULT_SETTINGS.provider,
        ...stored.provider,
        kind: 'laya',
        apiKeyConfigured
      },
      copilot: {
        ...DEFAULT_SETTINGS.copilot,
        ...stored.copilot,
        apiKeyConfigured: copilotKeyConfigured
      }
    }
  }

  async update(input: UpdateSettingsInput): Promise<AppSettings> {
    await mkdir(this.settingsDirectory, { recursive: true })
    if (input.clearApiKey) {
      await rm(this.secretPath, { force: true })
    } else if (input.apiKey?.trim()) {
      if (!safeStorage.isEncryptionAvailable()) {
        throw new Error('Secure credential storage is unavailable on this computer.')
      }
      await writeFile(this.secretPath, safeStorage.encryptString(input.apiKey.trim()))
    }
    if (input.clearCopilotApiKey) {
      await rm(this.copilotSecretPath, { force: true })
    } else if (input.copilotApiKey?.trim()) {
      if (!safeStorage.isEncryptionAvailable()) {
        throw new Error('Secure credential storage is unavailable on this computer.')
      }
      await writeFile(this.copilotSecretPath, safeStorage.encryptString(input.copilotApiKey.trim()))
    }
    const settings: AppSettings = {
      provider: {
        ...input.provider,
        kind: 'laya',
        apiKeyConfigured: input.clearApiKey ? false : Boolean(input.apiKey?.trim()) || (await this.hasSecret())
      },
      copilot: {
        ...input.copilot,
        apiKeyConfigured: input.clearCopilotApiKey ? false : Boolean(input.copilotApiKey?.trim()) || (await this.hasCopilotSecret())
      },
      defaultPersistAnalysisResults: input.defaultPersistAnalysisResults,
      theme: 'light'
    }
    const { apiKeyConfigured: _apiKeyConfigured, ...persistedProvider } = settings.provider
    const { apiKeyConfigured: _copilotConfigured, ...persistedCopilot } = settings.copilot
    await writeJsonAtomic(this.settingsPath, { ...settings, provider: persistedProvider, copilot: persistedCopilot })
    return settings
  }

  async getProviderSecret(): Promise<string | null> {
    try {
      const encrypted = await readFile(this.secretPath)
      if (!safeStorage.isEncryptionAvailable()) return null
      return safeStorage.decryptString(encrypted)
    } catch {
      return null
    }
  }

  async getCopilotSecret(): Promise<string | null> {
    try {
      const encrypted = await readFile(this.copilotSecretPath)
      if (!safeStorage.isEncryptionAvailable()) return null
      return safeStorage.decryptString(encrypted)
    } catch {
      return null
    }
  }

  private async hasSecret(): Promise<boolean> {
    return readFile(this.secretPath).then(() => true).catch(() => false)
  }

  private async hasCopilotSecret(): Promise<boolean> {
    return readFile(this.copilotSecretPath).then(() => true).catch(() => false)
  }
}
