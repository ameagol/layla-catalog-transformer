import { z } from 'zod'

const projectIdSchema = z.string().uuid()
const mappingsSchema = z.record(z.string(), z.string().min(1)).default({})
const ruleImpactsSchema = z.record(z.string().regex(/^rule-[0-9]+-[0-9a-z]+$/), z.enum(['small', 'medium', 'large']))
export const rulePrioritySchema = z.enum(['low', 'low_medium', 'medium', 'medium_high', 'high'])
export const ruleConfigurationsSchema = z.record(z.string().regex(/^rule-[0-9]+-[0-9a-z]+$/), z.object({
  priority: rulePrioritySchema.optional(),
  actionItem: z.string().trim().min(1, 'An action item override cannot be blank.').max(2_000).optional(),
  conditionValues: z.record(z.string().min(1).max(200), z.array(z.string().trim().min(1).max(256)).max(100)).optional(),
  reference: z.object({ sheetName: z.string().min(1).max(200), columnMappings: mappingsSchema }).optional(),
  similarity: z.object({ threshold: z.number().min(0).max(1), weights: z.record(z.string().min(1).max(200), z.number().min(0).max(1)) }).optional()
}))

export const createProjectInputSchema = z.object({
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().max(500).optional()
})

export const updateProjectDetailsInputSchema = createProjectInputSchema.extend({
  id: projectIdSchema,
  description: z.string().trim().max(500)
})

export const updateProjectInputSchema = z.object({
  id: projectIdSchema,
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().max(500),
  rulesText: z.string().max(100_000),
  disabledRuleIds: z.array(z.string().min(1)).max(5_000),
  ruleImpacts: ruleImpactsSchema.optional(),
  ruleConfigurations: ruleConfigurationsSchema.optional(),
  columnMappings: mappingsSchema,
  sourceFilePath: z.string().max(4_096).optional(),
  selectedSheet: z.string().max(200).optional(),
  persistAnalysisResults: z.boolean()
})

export const workbookPathSchema = z.object({
  projectId: projectIdSchema,
  filePath: z.string().min(1).max(4_096)
})

export const interpretationPreviewInputSchema = z.object({
  sessionId: z.string().uuid().optional(),
  sheetName: z.string().min(1).max(200).optional(),
  rulesText: z.string().max(100_000),
  disabledRuleIds: z.array(z.string().min(1)).max(5_000),
  columnMappings: mappingsSchema,
  ruleConfigurations: ruleConfigurationsSchema.optional()
})

export const analysisInputSchema = z.object({
  projectId: projectIdSchema,
  sessionId: z.string().uuid(),
  sheetName: z.string().min(1).max(200),
  rulesText: z.string().max(100_000),
  disabledRuleIds: z.array(z.string().min(1)).max(5_000),
  ruleImpacts: ruleImpactsSchema.optional(),
  ruleConfigurations: ruleConfigurationsSchema.optional(),
  columnMappings: mappingsSchema
})

export const correctedCsvInputSchema = z.object({
  analysisId: z.string().uuid(),
  deletedRowNumbers: z.array(z.number().int().positive().max(1_100_000)).max(1_100_000)
    .refine((rows) => new Set(rows).size === rows.length, 'Deleted row numbers must be unique.')
})

export const reviewedWorkbookInputSchema = z.object({
  analysisId: z.string().uuid(),
  acceptedRowNumbers: z.array(z.number().int().positive().max(1_100_000)).max(1_100_000)
    .refine((rows) => new Set(rows).size === rows.length, 'Accepted row numbers must be unique.')
})


export const findingRowsInputSchema = z.object({
  analysisId: z.string().uuid(),
  findingId: z.string().regex(/^finding-[0-9a-z]+$/),
  offset: z.number().int().nonnegative().default(0)
})

export const copilotGuideInputSchema = z.object({
  analysisId: z.string().uuid(),
  findingId: z.string().regex(/^finding-[0-9a-z]+$/)
})

export const copilotAskInputSchema = copilotGuideInputSchema.extend({
  question: z.string().trim().min(1).max(1_000)
})

export const copilotRowsInputSchema = copilotGuideInputSchema.extend({
  columnKeys: z.array(z.string().min(1).max(200)).max(8).refine((keys) => new Set(keys).size === keys.length)
})

export const updateSettingsInputSchema = z.object({
  provider: z.object({
    kind: z.enum(['deterministic', 'jev', 'laya', 'custom']),
    endpoint: z.string().trim().max(2_048),
    model: z.string().trim().max(200),
    sendColumnExamples: z.boolean()
  }),
  apiKey: z.string().max(8_192).optional(),
  clearApiKey: z.boolean().optional(),
  copilot: z.object({
    endpoint: z.string().trim().max(2_048),
    model: z.string().trim().max(200),
    sendFindingEvidence: z.boolean()
  }),
  copilotApiKey: z.string().max(8_192).optional(),
  clearCopilotApiKey: z.boolean().optional(),
  defaultPersistAnalysisResults: z.boolean(),
  theme: z.literal('light')
})

export { projectIdSchema }
