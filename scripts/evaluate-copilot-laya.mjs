import { join, resolve } from 'node:path'
import { Agent } from 'laya-ts'

const dir = resolve(process.argv[2] ?? join(process.env.APPDATA ?? '', 'catalog-transformer', 'models', 'laya-multilingual'))
const agent = await Agent.load(dir, { device: 'cpu' })

const cases = [
  {
    name: 'Missing attribute',
    state: { type: 'MISSING', rule: 'A product must have a category.', fields: ['Category'], confidence: 'HIGH', observations: [] },
    criteria: { complete_attribute: 'Consultar a fonte para completar um atributo ausente', verify_source: 'Conferir um valor inconsistente ou inválido na fonte', human_review: 'Informação insuficiente; exigir revisão humana sem afirmar erro' }
  },
  {
    name: 'Invalid value',
    state: { type: 'INVALID', rule: 'The invoice date must be valid.', fields: ['Date'], confidence: 'HIGH', observations: [] },
    criteria: { verify_source: 'Conferir um valor inconsistente ou inválido na fonte', human_review: 'Informação insuficiente; exigir revisão humana sem afirmar erro' }
  },
  {
    name: 'Conflicting possible match',
    state: { type: 'POSSIBLE_DUPLICATE', rule: 'Find similar supplier names.', fields: ['Supplier name'], confidence: 'LOW', observations: ['Code: not equal after case/space normalization; verify against source'] },
    criteria: { review_duplicate: 'Comparar registros na fonte para verificar se são a mesma entidade', check_relationship: 'Conferir se são registros relacionados mas distintos', human_review: 'Informação insuficiente; exigir revisão humana sem afirmar erro' }
  }
]

for (const item of cases) {
  const result = await agent.predict(JSON.stringify(item.state), {
    route: { type: 'choice', instructions: 'Qual o próximo passo prudente para investigar este achado de qualidade? Não confirme uma correção nem reavalie se a regra foi violada. Se faltar evidência, escolha revisão humana.', criteria: item.criteria }
  }, { lang: 'pt', minConfidence: 0.8 })
  const answer = result.answers.route
  console.log(JSON.stringify({ case: item.name, choice: answer.choice, confidence: answer.answer_confidence, abstain: answer.answer_confidence < 0.8, truncated: result.usage.truncated }))
}

const focus = await agent.predict(JSON.stringify({ worksheet: 'Inventory', rows: 200, candidates: [
  { id: 'missing-category', evidence: '35% empty in a column not referenced by an interpreted rule. Missing data may be allowed; confirm before adding a rule.' },
  { id: 'rule-0', evidence: 'This rule was not fully executable (missing field). Confirm its interpretation or mapping.' }
] }), { focus: { type: 'choice', instructions: 'Which already observed coverage question is most useful to review next? Never claim an untested row violates a rule; abstain if uncertain.', criteria: {
  'missing-category': 'Review coverage of Category: 35% empty in a column not referenced by an interpreted rule. Missing data may be allowed; confirm before adding a rule.',
  'rule-0': 'Review rule 0: This rule was not fully executable (missing field). Confirm its interpretation or mapping.',
  needs_review: 'No option has enough evidence for a prioritized suggestion'
} } }, { lang: 'en', minConfidence: 0.8 })
console.log(JSON.stringify({ case: 'Coverage', choice: focus.answers.focus.choice, confidence: focus.answers.focus.answer_confidence, truncated: focus.usage.truncated }))
