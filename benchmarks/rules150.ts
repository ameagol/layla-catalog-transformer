import { commercialCases } from './commercialCases'
import { guardrailCases } from './guardrailCases'
import { supportedCases } from './supportedCases'

export const ruleBenchmarkCases = [...commercialCases(), ...supportedCases(), ...guardrailCases()]

if (ruleBenchmarkCases.length !== 150 || new Set(ruleBenchmarkCases.map((test) => test.id)).size !== 150 || new Set(ruleBenchmarkCases.map((test) => test.sourceText)).size !== 150) {
  throw new Error('The rule benchmark must contain exactly 150 distinct IDs and rule texts.')
}
