import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

async function ensureParent(filePath: string): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true })
}

export async function readJsonFile<T>(filePath: string): Promise<T> {
  return JSON.parse(await readFile(filePath, 'utf8')) as T
}

export async function writeTextAtomic(filePath: string, content: string): Promise<void> {
  await ensureParent(filePath)
  const temporaryPath = `${filePath}.${process.pid}.${Date.now()}.tmp`
  await writeFile(temporaryPath, content, 'utf8')
  await rename(temporaryPath, filePath)
}

export async function writeJsonAtomic(filePath: string, value: unknown): Promise<void> {
  await writeTextAtomic(filePath, `${JSON.stringify(value, null, 2)}\n`)
}

export async function writeBufferAtomic(filePath: string, content: Uint8Array): Promise<void> {
  await ensureParent(filePath)
  const temporaryPath = `${filePath}.${crypto.randomUUID()}.tmp`
  try {
    await writeFile(temporaryPath, content, { flag: 'wx' })
    await rename(temporaryPath, filePath)
  } finally {
    await unlink(temporaryPath).catch((error: NodeJS.ErrnoException) => { if (error.code !== 'ENOENT') throw error })
  }
}
