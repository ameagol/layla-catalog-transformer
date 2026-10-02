import { z } from 'zod'
import { rulePrioritySchema } from '../ipc/schemas'

const semanticTypeSchema = z.enum([
  'name',
  'phone',
  'email',
  'cpf',
  'cnpj',
  'identifier',
  'date',
  'number',
  'text',
  'unknown'
])

const fieldCandidateSchema = z.object({
  columnKey: z.string().min(1),
  columnHeader: z.string().min(1),
  score: z.number().min(0).max(1),
  reason: z.string().min(1)
})

const fieldBindingSchema = z.object({
  token: z.string().min(1),
  role: z.enum(['match', 'key', 'dependent', 'target']),
  semanticType: semanticTypeSchema,
  status: z.enum(['resolved', 'ambiguous', 'missing']),
  columnKey: z.string().min(1).optional(),
  columnHeader: z.string().min(1).optional(),
  candidates: z.array(fieldCandidateSchema).max(10)
})

export const ruleInterpretationSchema = z.object({
  id: z.string().min(1),
  sourceText: z.string().min(1),
  category: z.enum(['duplicate', 'normalization', 'validation', 'uniqueness', 'consistency', 'missing', 'similarity']),
  status: z.enum(['valid', 'needs_mapping', 'needs_configuration', 'unsupported']),
  entity: z.string().min(1),
  purpose: z.string().min(1),
  title: z.string().optional(),
  priority: rulePrioritySchema.optional(),
  actionItem: z.string().optional(),
  logicSummary: z.string().optional(),
  fields: z.array(fieldBindingSchema).max(20),
  normalizations: z.array(
    z.enum([
      'unicode',
      'trim',
      'lowercase',
      'uppercase',
      'remove_accents',
      'normalize_whitespace',
      'remove_whitespace',
      'remove_punctuation',
      'digits_only',
      'phone_br',
      'email',
      'identifier'
    ])
  ),
  logic: z.enum(['and', 'or']),
  comparison: z.enum(['equals', 'similarity', 'validate', 'unique', 'required', 'consistent']),
  similarity: z
    .object({
      algorithm: z.enum(['jaro_winkler', 'levenshtein', 'token_jaccard']),
      threshold: z.number().min(0).max(1)
    })
    .optional(),
  validator: z.enum(['email', 'cpf', 'cnpj', 'phone_br', 'date', 'number', 'required']).optional(),
  severity: z.enum(['info', 'warning', 'error', 'critical']),
  interpretationConfidence: z.number().min(0).max(1),
  explanation: z.string().min(1),
  warnings: z.array(z.string())
})

export const externalInterpretationResponseSchema = z.object({
  contractVersion: z.literal('1'),
  interpretations: z.array(ruleInterpretationSchema)
})
