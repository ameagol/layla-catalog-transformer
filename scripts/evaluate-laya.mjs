import { join, resolve } from 'node:path'
import { Agent } from 'laya-ts'

const modelDir = resolve(process.argv[2] ?? join(process.env.APPDATA ?? '', 'catalog-transformer', 'models', 'laya-multilingual'))
const agent = await Agent.load(modelDir, { device: 'cpu' })
const routes = {
  review_duplicate: 'Comparar registros e confirmar possível duplicação na fonte',
  verify_source: 'Conferir um valor inconsistente ou inválido na fonte',
  complete_attribute: 'Consultar a fonte para completar um atributo ausente',
  human_review: 'Informação insuficiente; exigir revisão humana sem afirmar erro'
}
const examples = [
  { type: 'POSSIBLE_DUPLICATE', rule: 'Consider customers duplicates when their name and phone are equal after ignoring accents, capitalization, spaces and phone formatting.', fields: ['Name', 'Phone'], confidence: 'MEDIUM', expected: 'review_duplicate' },
  { type: 'MISSING', rule: 'Flag customers with a missing email.', fields: ['Email'], confidence: 'HIGH', expected: 'complete_attribute' },
  { type: 'INVALID', rule: 'Brazilian phone numbers must contain a valid DDD.', fields: ['Phone'], confidence: 'HIGH', expected: 'verify_source' },
  { type: 'RULE_VIOLATION', rule: 'A CPF must not be associated with different customer names.', fields: ['CPF', 'Name'], confidence: 'LOW', expected: 'human_review' }
]

for (const item of examples) {
  const state = JSON.stringify({ type: item.type, rule: item.rule, fields: item.fields, confidence: item.confidence })
  const instructions = 'Qual o próximo passo prudente para revisar este achado de cadastro? Se não houver evidência suficiente, escolha revisão humana.'
  for (const [name, criteria] of [
    ['four', routes],
    ['two', { [item.expected]: routes[item.expected], human_review: routes.human_review }]
  ]) {
    if (name === 'two' && item.expected === 'human_review') continue
    const result = await agent.predict(state, { route: { type: 'choice', instructions, criteria } }, { lang: 'pt' })
    const answer = result.answers.route
    if (answer.type !== 'choice') throw new Error('Expected a choice decision')
    console.log(JSON.stringify({ example: item.type, options: name, expected: item.expected,
      choice: answer.choice, confidence: answer.answer_confidence, probabilities: answer.probabilities }))
  }
}
