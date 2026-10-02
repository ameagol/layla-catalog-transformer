import type {
  AnalysisProgress,
  AnalysisRequest,
  AnalysisResult,
  CompilationResult,
  FindingSourceRows,
  InterpretationPreviewRequest,
  WorksheetProfile
} from '@core/index'
import { analyzeDataset } from '@core/engine/analyze'
import { buildFindingSourceRows } from '@core/findings/sourceRows'
import { consolidateFindings } from '@core/findings/consolidate'
import { sortFindingsByImpact } from '@core/findings/review'
import { compileInterpretations } from '@core/rules/compiler'
import { parseSourceRules } from '@core/rules/source'
import type { RuleConfiguration } from '@core/model/businessRules'
import { impactPriority, priorityImpact } from '@core/rules/metadata'

import { NlpService } from './nlpService'
import { ProjectStore } from './projectStore'
import { WorkbookService } from './workbookService'

export class AnalysisService {
  private readonly results = new Map<string, AnalysisResult>()
  private activeResultId: string | null = null

  constructor(
    private readonly workbookService: WorkbookService,
    private readonly projectStore: ProjectStore,
    private readonly nlpService: Pick<NlpService, 'interpret'>
  ) {}

  async preview(input: InterpretationPreviewRequest): Promise<CompilationResult> {
    const profile = input.sessionId && input.sheetName
      ? (await this.workbookService.getWorksheetData(input.sessionId, input.sheetName)).profile
      : undefined
    return this.compile(input.rulesText, input.disabledRuleIds, input.columnMappings, profile, input.ruleConfigurations)
  }

  async run(input: AnalysisRequest, onProgress?: (progress: AnalysisProgress) => void): Promise<AnalysisResult> {
    onProgress?.({ stage: 'compile', percent: 0, message: 'Laya AI is validating every enabled rule…' })
    const dataset = await this.workbookService.getWorksheetData(input.sessionId, input.sheetName)
    const compilation = await this.compile(
      input.rulesText,
      input.disabledRuleIds,
      input.columnMappings,
      dataset.profile,
      input.ruleConfigurations
    )
    if (!compilation.canRun) {
      throw new Error(compilation.issues[0]?.message ?? 'No executable rules are available for analysis.')
    }
    const result = await analyzeDataset({
      projectId: input.projectId,
      sessionId: input.sessionId,
      sheetName: input.sheetName,
      rows: dataset.rows,
      compilation,
      onProgress
    })
    const impacts = input.ruleImpacts ?? (await this.projectStore.get(input.projectId)).ruleImpacts
    for (const finding of result.findings) {
      const override = impacts?.[finding.ruleId]
      const configured = input.ruleConfigurations?.[finding.ruleId]?.priority
      finding.priority = configured ?? (override ? impactPriority(override) : finding.priority)
      finding.impactLevel = configured ? priorityImpact(configured) : override ?? priorityImpact(finding.priority)
    }
    result.findings = sortFindingsByImpact(result.findings)
    this.results.set(result.id, result)
    this.activeResultId = result.id
    await this.projectStore.recordAnalysis(input.projectId, result)
    this.pruneResults(result.id)
    return result
  }

  getResult(analysisId: string): AnalysisResult {
    const result = this.results.get(analysisId)
    if (!result) throw new Error('The analysis result is no longer in memory. Run the analysis again before exporting.')
    return result
  }

  getActiveResult(analysisId: string): AnalysisResult {
    if (analysisId !== this.activeResultId) throw new Error('Analysis is no longer active. Run the analysis again.')
    return this.getResult(analysisId)
  }

  async getFindingRows(analysisId: string, findingId: string, offset = 0): Promise<FindingSourceRows> {
    const result = this.getActiveResult(analysisId)
    const finding = consolidateFindings(result.findings).find((candidate) => candidate.findings.some((member) => member.id === findingId))
    if (!finding) throw new Error('Finding does not belong to the active analysis.')
    const dataset = await this.workbookService.getWorksheetData(result.sessionId, result.sheetName)
    this.getActiveResult(analysisId)
    return buildFindingSourceRows(finding, dataset.profile.columns, dataset.rows, offset)
  }

  async getDatasetForExport(analysisId: string, deletedRowNumbers: readonly number[]) {
    const result = this.getActiveResult(analysisId)
    const affectedRows = new Set(result.findings.flatMap((finding) => finding.rowNumbers))
    if (deletedRowNumbers.some((rowNumber) => !Number.isInteger(rowNumber) || !affectedRows.has(rowNumber))) {
      throw new Error('Only rows from the active findings can be excluded. Run the analysis again and review those rows.')
    }
    const dataset = await this.workbookService.getWorksheetData(result.sessionId, result.sheetName)
    this.getActiveResult(analysisId)
    return { ...dataset, sourceFilePath: this.workbookService.getSourcePath(result.sessionId) }
  }

  async getDatasetForReviewedExport(analysisId: string, acceptedRowNumbers: readonly number[]) {
    const result = this.getActiveResult(analysisId)
    const affected = new Set(result.findings.flatMap((finding) => finding.rowNumbers))
    if (new Set(acceptedRowNumbers).size !== acceptedRowNumbers.length || acceptedRowNumbers.some((row) => !Number.isInteger(row) || !affected.has(row))) {
      throw new Error('Only distinct source rows from the active findings can be accepted for export.')
    }
    return this.getDatasetForExport(analysisId, [])
  }

  private async compile(
    rulesText: string,
    disabledRuleIds: string[],
    columnMappings: Record<string, string>,
    profile?: WorksheetProfile,
    ruleConfigurations?: Record<string, RuleConfiguration>
  ): Promise<CompilationResult> {
    const rules = parseSourceRules(rulesText, disabledRuleIds)
    const interpretations = await this.nlpService.interpret({ rules, profile, columnMappings, ruleConfigurations })
    const enabled = rules.filter((rule) => rule.enabled)
    if (interpretations.length !== enabled.length || interpretations.some((interpretation) =>
      !enabled.some((rule) => rule.id === interpretation.id && rule.sourceText === interpretation.sourceText)
    ) || new Set(interpretations.map((interpretation) => interpretation.id)).size !== enabled.length) {
      throw new Error('Laya AI did not return a complete review of every enabled rule. Validate again before running.')
    }
    const compilation = compileInterpretations(interpretations)
    const approved = interpretations.every((interpretation) => interpretation.aiValidation?.provider === 'laya' && interpretation.aiValidation.decision === 'approved')
    if (!approved && !compilation.issues.length && enabled[0]) {
      compilation.issues.push({ ruleId: enabled[0].id, code: 'INVALID_RULE', message: 'Every enabled rule needs Laya AI approval before analysis.' })
    }
    return { ...compilation, provider: 'laya', canRun: compilation.canRun && approved && compilation.issues.length === 0 }
  }

  private pruneResults(activeId: string): void {
    if (this.results.size <= 5) return
    for (const analysisId of this.results.keys()) {
      if (analysisId !== activeId) {
        this.results.delete(analysisId)
        if (this.results.size <= 5) break
      }
    }
  }
}
