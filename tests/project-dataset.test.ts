import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import ExcelJS from 'exceljs'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { createProjectInputSchema } from '../src/core/ipc/schemas'
import { ProjectDatasetService } from '../src/main/services/projectDatasetService'
import { ProjectStore } from '../src/main/services/projectStore'
import { WorkbookService } from '../src/main/services/workbookService'

vi.mock('electron/main', () => ({ default: { dialog: { showOpenDialog: vi.fn().mockResolvedValue({ canceled: true, filePaths: [] }) } } }))

const directories: string[] = []

async function setup() {
  const directory = await mkdtemp(join(tmpdir(), 'catalog-project-workflow-'))
  directories.push(directory)
  const projects = new ProjectStore(directory)
  const workbooks = new WorkbookService()
  return { directory, projects, workbooks, datasets: new ProjectDatasetService(projects, workbooks) }
}

async function workbookAt(filePath: string, sheetName: string) {
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet(sheetName)
  sheet.addRow(['ID', 'Name', 'Email'])
  sheet.addRow([1, 'Record A', 'a@example.test'])
  await workbook.xlsx.writeFile(filePath)
}

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })))
})

describe('blank project lifecycle', () => {
  it('starts with no seeded projects and always creates blank rule sources', async () => {
    const { projects } = await setup()
    await projects.initialize()
    expect(await projects.list()).toEqual([])
    const project = await projects.create(createProjectInputSchema.parse({ name: 'Own project', useDemoRules: true }))
    expect(project.rulesText).toBe('')
    await projects.initialize()
    expect((await projects.list()).map((item) => item.id)).toEqual([project.id])
  })

  it('removes only the legacy demo project and workbook while preserving user content', async () => {
    const { directory, projects } = await setup()
    const project = await projects.create({ name: 'Own project' })
    const legacyPath = join(directory, 'projects', '00000000-0000-4000-8000-000000000001')
    await mkdir(legacyPath, { recursive: true })
    await writeFile(join(legacyPath, 'rules.txt'), 'Legacy rules')
    await mkdir(join(directory, 'samples'))
    await writeFile(join(directory, 'samples', 'customer-data-quality-demo.xlsx'), 'Legacy workbook')
    await writeFile(join(directory, 'samples', 'my-workbook.xlsx'), 'User workbook')
    await projects.initialize()
    await expect(access(legacyPath)).rejects.toThrow()
    await expect(access(join(directory, 'samples', 'customer-data-quality-demo.xlsx'))).rejects.toThrow()
    expect(await readFile(join(directory, 'samples', 'my-workbook.xlsx'), 'utf8')).toBe('User workbook')
    expect((await projects.get(project.id)).name).toBe('Own project')
  })
})

describe('one workbook per project', () => {
  it('persists workbook associations and restores the right workbook after a restart', async () => {
    const { directory, projects, datasets } = await setup()
    const first = await projects.create({ name: 'First' })
    const second = await projects.create({ name: 'Second' })
    const firstPath = join(directory, 'first.xlsx')
    const secondPath = join(directory, 'second.xlsx')
    await workbookAt(firstPath, 'First data')
    await workbookAt(secondPath, 'Second data')
    await datasets.inspect(first.id, firstPath)
    await datasets.inspect(second.id, secondPath)
    const restored = new ProjectDatasetService(new ProjectStore(directory), new WorkbookService())
    expect((await restored.open(first.id))?.selectedSheet.name).toBe('First data')
    expect((await restored.open(second.id))?.fileName).toBe('second.xlsx')
    expect((await projects.get(first.id)).sourceFilePath).toBe(firstPath)
  })

  it('replaces the attachment instead of accumulating workbooks and resets old mappings', async () => {
    const { directory, projects, datasets } = await setup()
    const project = await projects.create({ name: 'Quality' })
    const firstPath = join(directory, 'first.xlsx')
    const secondPath = join(directory, 'second.xlsx')
    await workbookAt(firstPath, 'First data')
    await workbookAt(secondPath, 'Second data')
    const first = await datasets.inspect(project.id, firstPath)
    await projects.update({ ...first.project, columnMappings: { email: 'email' } })
    expect((await datasets.inspect(project.id, firstPath)).project.columnMappings).toEqual({ email: 'email' })
    const replacement = await datasets.inspect(project.id, secondPath)
    expect(replacement.project.columnMappings).toEqual({})
    expect((await projects.get(project.id)).sourceFilePath).toBe(secondPath)
    expect((await datasets.open(project.id))?.fileName).toBe('second.xlsx')
    await expect(access(firstPath)).resolves.toBeUndefined()
  })

  it('keeps the existing attachment if the picker is canceled or the new file fails', async () => {
    const { directory, projects, datasets } = await setup()
    const project = await projects.create({ name: 'Quality' })
    const filePath = join(directory, 'source.xlsx')
    await workbookAt(filePath, 'Data')
    await datasets.inspect(project.id, filePath)
    expect(await datasets.choose(project.id, {} as Electron.BrowserWindow)).toBeNull()
    await expect(datasets.inspect(project.id, join(directory, 'missing.xlsx'))).rejects.toThrow()
    expect((await projects.get(project.id)).sourceFilePath).toBe(filePath)
  })

  it('does not load a workbook for an unknown project and returns null for an empty project', async () => {
    const { projects, workbooks, datasets } = await setup()
    const inspect = vi.spyOn(workbooks, 'inspectPath')
    await expect(datasets.inspect('not-a-project', 'C:\\data.xlsx')).rejects.toThrow()
    expect(inspect).not.toHaveBeenCalled()
    const project = await projects.create({ name: 'Blank' })
    expect(await datasets.open(project.id)).toBeNull()
  })
})
