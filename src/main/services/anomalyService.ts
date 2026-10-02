import type { AnomalyScanResult, GovernanceRuleDraft } from '@core/anomaly/types'
import { scanWorksheetAnomalies } from '@core/anomaly/scanner'
import { buildLayaAnomalyQuestions, buildLayaAnomalyState } from '@core/anomaly/layaDecisions'
import type { LayaService } from './layaService'
import type { WorkbookService } from './workbookService'

export class AnomalyService {
  constructor(
    private readonly workbooks: WorkbookService,
    private readonly laya?: Pick<LayaService, 'predict'>
  ) {}

  async detectAnomalies(sessionId: string, sheetName: string): Promise<AnomalyScanResult> {
    const { profile, rows } = await this.workbooks.getWorksheetData(sessionId, sheetName)

    // 1. Executa a varredura primária com perfil de colunas para invariantes universais
    const scanResult = scanWorksheetAnomalies(sheetName, profile.columns, rows, profile.columns)

    // 2. Se o Laya estiver disponível, executa o "Generalization Gatekeeper" para filtrar regras candidatas
    if (this.laya && scanResult.draftRules.length > 0) {
      const verifiedDrafts: GovernanceRuleDraft[] = []

      for (const draft of scanResult.draftRules) {
        try {
          const layaDecision = await this.laya.predict(
            {
              proposed_rule: draft.ruleText,
              column_name: draft.columnHeader,
              rationale: draft.reason
            },
            {
              generalization_check: {
                type: 'choice',
                options: {
                  universal_rule: 'Universal quality invariant suitable for the whole catalog',
                  overfitted_coincidence: 'Too specific, temporary row artifact or coincidental correlation'
                }
              }
            },
            { lang: 'en', minConfidence: 0.70 }
          )

          const answer = layaDecision.answers['generalization_check']
          // Somente mantém se o Laya confirmar que é uma regra universal (ou não vetar com certeza absoluta)
          if (answer && 'choice' in answer && answer.choice === 'overfitted_coincidence') {
            continue // Descarte silencioso de regra hiper-específica!
          }
          verifiedDrafts.push(draft)
        } catch {
          // Se o Laya falhar ou timeout, mantém a invariante baseada nas regras determinísticas rígidas
          verifiedDrafts.push(draft)
        }
      }

      scanResult.draftRules = verifiedDrafts
    }

    // 3. Julgamento Laya das top anomalias observadas
    if (this.laya && scanResult.anomalies.length > 0) {
      const sampleAnomalies = scanResult.anomalies
        .filter((a) => a.severity === 'critical' || a.severity === 'error')
        .slice(0, 5)

      for (const anomaly of sampleAnomalies) {
        try {
          const state = buildLayaAnomalyState(anomaly)
          const questions = buildLayaAnomalyQuestions()
          const layaDecision = await this.laya.predict(state, questions, { lang: 'en', minConfidence: 0.75 })

          const catAnswer = layaDecision.answers['anomaly_category']
          const isGenuineAnswer = layaDecision.answers['is_genuine_anomaly']

          if (catAnswer && 'choice' in catAnswer && typeof catAnswer.choice === 'string') {
            if (catAnswer.choice === 'valid_exception') {
              anomaly.severity = 'info'
              anomaly.explanation += ` [Laya Review: Considerado provável exceção de negócio legítima].`
            } else if (catAnswer.choice === 'syntax_deviation') {
              anomaly.explanation += ` [Laya Review: Confirmado desvio de sintaxe estrutural].`
            }
          }

          if (isGenuineAnswer && 'noul' in isGenuineAnswer && typeof isGenuineAnswer.noul === 'boolean') {
            if (isGenuineAnswer.noul) {
              anomaly.confidence = 'HIGH'
            }
          }
        } catch {
          // Mantém determinístico
        }
      }
    }

    return scanResult
  }
}
