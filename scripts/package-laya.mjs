import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { readFile, stat } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { spawnSync } from 'node:child_process'

import { Arch, build, Platform } from 'electron-builder'

if (process.platform !== 'win32' || process.arch !== 'x64') {
  throw new Error('The offline Laya installer must be built on Windows x64.')
}
if (!process.argv[2]) throw new Error('Usage: node scripts/package-laya.mjs <verified model directory>')
const dir = resolve(process.argv[2])
const manifest = JSON.parse(await readFile(join(dir, 'manifest.json'), 'utf8'))
if (manifest.model !== 'convaiinnovations/laya/multilingual' ||
    manifest.runtimeRevision !== '6d942c92081fbc139e736bbd9ac0023223c29b7f') {
  throw new Error('Model is not verified for this pinned Laya runtime.')
}
for (const name of ['encoder.onnx', 'encoder.onnx.data', 'head.onnx', 'head.onnx.data', 'tokenizer.json', 'rl_agent_config.json']) {
  if (!(await stat(join(dir, name))).isFile() || !manifest.sha256?.[name]) {
    throw new Error(`Model artifact missing from verified manifest: ${name}`)
  }
  const hash = createHash('sha256')
  for await (const chunk of createReadStream(join(dir, name))) hash.update(chunk)
  if (hash.digest('hex') !== manifest.sha256[name]) throw new Error(`Model artifact changed after verification: ${name}`)
}
const compiled = spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'build'], { stdio: 'inherit', shell: process.platform === 'win32' })
if (compiled.error || compiled.status !== 0) throw compiled.error ?? new Error('App build failed')
const pkg = JSON.parse(await readFile(resolve('package.json'), 'utf8'))
await build({
  targets: Platform.WINDOWS.createTarget('nsis', Arch.x64),
  config: {
    ...pkg.build,
    directories: { ...pkg.build.directories, output: 'release-laya' },
    extraResources: [{ from: dir, to: 'models/laya-multilingual', filter: ['*.onnx', '*.onnx.data', '*.json'] }]
  }
})
