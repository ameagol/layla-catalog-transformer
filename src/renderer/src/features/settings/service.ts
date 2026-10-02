import type { AppSettings, UpdateSettingsInput } from '@core/model/domain'
import type { ProviderTestResult } from '@core/ipc/contracts'

export const settingsService = {
  get: (): Promise<AppSettings> => window.catalogTransformer.getSettings(),
  update: (input: UpdateSettingsInput): Promise<AppSettings> => window.catalogTransformer.updateSettings(input),
  testProvider: (): Promise<ProviderTestResult> => window.catalogTransformer.testProvider()
}

