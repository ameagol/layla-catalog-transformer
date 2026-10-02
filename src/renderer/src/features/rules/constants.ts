export const RULES_COPY = {
  eyebrow: 'Natural language source of truth',
  title: 'Rule studio',
  description: 'Write your rules, confirm column mappings, then validate with Laya AI and save.'
} as const

export const RULE_EXAMPLES = [
  'Check if Phone is not empty.',
  'Check if the Phone column exists.',
  'Find duplicate values in Name.',
  'Check that Email contains a valid email address.',
  'If Status is Active, Phone must not be empty.'
] as const

export const RULE_LABELS = {
  duplicate: 'Check Duplicate',
  missing: 'Check Missing',
  invalid: 'Invalid'
} as const

export const IMPACT_OPTIONS = [
  { value: 'small', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'large', label: 'High' }
] as const
