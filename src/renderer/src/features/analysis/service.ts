import type { AnalysisRequest, AnalysisResult } from '@core/model/domain'

export const analysisService = {
  run: (input: AnalysisRequest): Promise<AnalysisResult> => window.catalogTransformer.runAnalysis(input)
}

