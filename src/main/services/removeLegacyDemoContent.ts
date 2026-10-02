import { rm } from 'node:fs/promises'
import { isAbsolute, relative, resolve } from 'node:path'

export async function removeLegacyDemoContent(userDataPath: string): Promise<void> {
  const root = resolve(userDataPath)
  const targets = [
    { path: resolve(root, 'projects', '00000000-0000-4000-8000-000000000001'), recursive: true },
    { path: resolve(root, 'samples', 'customer-data-quality-demo.xlsx'), recursive: false }
  ]
  for (const target of targets) {
    const relativePath = relative(root, target.path)
    if (!relativePath || relativePath.startsWith('..') || isAbsolute(relativePath)) {
      throw new Error('Refusing to remove content outside the application data directory.')
    }
    await rm(target.path, { recursive: target.recursive, force: true })
  }
}
