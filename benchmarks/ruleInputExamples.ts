import { RULE_EXAMPLES } from '../src/renderer/src/features/rules/constants'
import type { GeneralLanguageCase } from './generalLanguageCases'

const records = [
  { Phone: null, Name: 'Alice', Email: 'invalid', Status: 'Active' },
  { Phone: '123', Name: 'Alice', Email: 'alice@example.test', Status: 'Inactive' },
  { Phone: '456', Name: 'Bob', Email: 'bob@example.test', Status: 'Active' }
]
const flaggedRows = [[2], [], [2, 3], [2], [2]]

export const ruleInputExamples: GeneralLanguageCase[] = RULE_EXAMPLES.map((text, index) => ({ text, records, rows: flaggedRows[index]! }))
