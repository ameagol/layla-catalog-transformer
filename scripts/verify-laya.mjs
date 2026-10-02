import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { stat, writeFile } from 'node:fs/promises'
import { resolve, join } from 'node:path'

import { Agent } from 'laya-ts'

if (process.platform !== 'win32' || process.arch !== 'x64') {
  throw new Error('Validate the local model on Windows x64 with Node; WSL verification is not sufficient.')
}
if (!process.argv[2]) throw new Error('Usage: npm run laya:verify -- <userData>/models/laya-multilingual')
const dir = resolve(process.argv[2])
const names = ['encoder.onnx', 'encoder.onnx.data', 'head.onnx', 'head.onnx.data', 'tokenizer.json', 'rl_agent_config.json']
const sha256 = {}
for (const name of names) {
  const file = join(dir, name)
  if (!(await stat(file)).isFile()) throw new Error(`Missing model artifact: ${file}`)
  const hash = createHash('sha256')
  for await (const chunk of createReadStream(file)) hash.update(chunk)
  sha256[name] = hash.digest('hex')
}

const agent = await Agent.load(dir, { device: 'cpu', expectedSha256: sha256 })
const result = await agent.predict('Cadastro de clientes: dois registros podem representar a mesma pessoa; conferir antes de alterar.', {
  route: {
    type: 'choice', instructions: 'Qual a próxima revisão prudente para este achado?',
    criteria: {
      review_duplicate: 'Comparar registros e confirmar possível duplicação na fonte',
      verify_source: 'Conferir um valor inconsistente ou inválido na fonte',
      complete_attribute: 'Consultar a fonte para completar um atributo ausente',
      human_review: 'Informação insuficiente, exigir revisão humana sem afirmar erro'
    }
  }
}, { lang: 'pt' })
if (result.answers.route?.type !== 'choice' || !Object.hasOwn(result.answers.route.probabilities, result.answers.route.choice)) {
  throw new Error('Laya failed the Portuguese choice inference smoke test.')
}

const manifest = {
  runtimeRevision: '6d942c92081fbc139e736bbd9ac0023223c29b7f',
  model: 'convaiinnovations/laya/multilingual',
  sha256
}
// Write the manifest only after a real Windows inference has succeeded.
await writeFile(join(dir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, { flag: 'w' })
console.log('Laya ONNX smoke passed; model hashes recorded in manifest.json')
console.log(`Choice: ${result.answers.route.choice}; confidence: ${result.answers.route.answer_confidence}`)
