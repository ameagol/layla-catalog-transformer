import type { AnalysisProgress } from '@core/engine/analyze'

export const appService = {
  getVersion: (): Promise<string> => window.catalogTransformer.getAppVersion(),
  onAnalysisProgress: (callback: (progress: AnalysisProgress) => void): (() => void) =>
    window.catalogTransformer.onAnalysisProgress(callback)
}

