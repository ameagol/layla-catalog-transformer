import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, relative, resolve, isAbsolute } from 'node:path'
import { tmpdir } from 'node:os'

const require = createRequire(import.meta.url)
const electronPath = require('electron') as string
const packagedExecutable = process.argv[2]
const executablePath = packagedExecutable ? resolve(packagedExecutable) : electronPath
const executableArguments = packagedExecutable
  ? []
  : [resolve(import.meta.dirname, '..')]
const environment = { ...process.env }
delete environment.ELECTRON_RUN_AS_NODE
environment.CATALOG_TRANSFORMER_SMOKE_TEST = '1'
const smokeUserData = mkdtempSync(join(tmpdir(), 'catalog-transformer-smoke-'))
environment.CATALOG_TRANSFORMER_SMOKE_USER_DATA = smokeUserData
if (packagedExecutable && existsSync(join(dirname(executablePath), 'resources', 'models', 'laya-multilingual', 'manifest.json'))) {
  environment.CATALOG_TRANSFORMER_SMOKE_EXPECT_LAYA = '1'
}
environment.CATALOG_TRANSFORMER_SMOKE_SCREENSHOT = join(tmpdir(), 'catalog-transformer-smoke.png')

const result = spawnSync(executablePath, executableArguments, {
  env: environment,
  stdio: 'inherit',
  timeout: environment.CATALOG_TRANSFORMER_SMOKE_EXPECT_LAYA ? 120_000 : 60_000,
  windowsHide: true
})

const temporaryRelativePath = relative(resolve(tmpdir()), resolve(smokeUserData))
if (!temporaryRelativePath || temporaryRelativePath.startsWith('..') || isAbsolute(temporaryRelativePath)) throw new Error('Refusing to clean up a smoke-test directory outside the temporary root.')
rmSync(smokeUserData, { recursive: true, force: true })

if (result.error) throw result.error
if (result.status !== 0) process.exit(result.status ?? 1)

console.log('Catalog Transformer smoke test passed.')
console.log(`Smoke screenshot: ${environment.CATALOG_TRANSFORMER_SMOKE_SCREENSHOT}`)
