import { createHash } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const revision = '6d942c92081fbc139e736bbd9ac0023223c29b7f'
const tree = 'd24583904e07d866aaaa782ef9043b79ad73ac28'
const base = `https://raw.githubusercontent.com/NandhaKishorM/laya/${revision}`
const response = await fetch(`https://api.github.com/repos/NandhaKishorM/laya/git/trees/${tree}`, {
  headers: { 'User-Agent': 'catalog-transformer-vendor' }
})
if (!response.ok) throw new Error(`Unable to resolve pinned Laya source: HTTP ${response.status}`)
const listing = await response.json()
if (listing.sha !== tree || listing.truncated) throw new Error('Unexpected upstream source tree')

const files = listing.tree.filter((item) => item.type === 'blob' && item.path.endsWith('.ts'))
if (files.length !== 13) throw new Error(`Unexpected number of Laya source files: ${files.length}`)
for (const file of files) {
  const source = await fetch(`${base}/laya-ts/src/${file.path}`)
  if (!source.ok) throw new Error(`Failed to retrieve ${file.path}: HTTP ${source.status}`)
  const bytes = Buffer.from(await source.arrayBuffer())
  const gitHash = createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex')
  if (gitHash !== file.sha) throw new Error(`Pinned Git hash mismatch for ${file.path}`)
  const target = join('vendor', 'laya-ts', 'src', file.path)
  await mkdir(join('vendor', 'laya-ts', 'src'), { recursive: true })
  await writeFile(target, bytes)
  console.log(`Verified ${target}`)
}

const licenseResponse = await fetch(`${base}/LICENSE`)
if (!licenseResponse.ok) throw new Error(`Failed to retrieve upstream license: HTTP ${licenseResponse.status}`)
await writeFile(join('vendor', 'laya-ts', 'LICENSE'), await licenseResponse.text())

const exporterResponse = await fetch(`${base}/laya-ts/scripts/export_onnx.py`)
if (!exporterResponse.ok) throw new Error(`Failed to retrieve pinned ONNX exporter: HTTP ${exporterResponse.status}`)
const exporter = Buffer.from(await exporterResponse.arrayBuffer())
if (createHash('sha1').update(`blob ${exporter.length}\0`).update(exporter).digest('hex') !== 'd82f7f28c70cd884ea0c48e0dddf4648612bc3cf') {
  throw new Error('Pinned ONNX exporter hash mismatch')
}
await mkdir(join('vendor', 'laya-ts', 'scripts'), { recursive: true })
await writeFile(join('vendor', 'laya-ts', 'scripts', 'export_onnx.py'), exporter)
