import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

import { ProjectStore } from '../src/main/services/projectStore'
import { parseSourceRules } from '../src/core/rules/source'
import { updateProjectDetailsInputSchema } from '../src/core/ipc/schemas'

const directories: string[] = []
afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })))
})

describe('project rule impact persistence', () => {
  it('persists rule priority, action and reference setup across project reloads', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'catalog-impact-'))
    directories.push(directory)
    const store = new ProjectStore(directory)
    const project = await store.create({ name: 'Business policy' })
    const ruleConfigurations = { 'rule-1-test': { priority: 'high' as const, actionItem: 'Route to the owner.', reference: { sheetName: 'Owners', columnMappings: {} } } }
    await store.update({ ...project, ruleConfigurations })
    expect((await new ProjectStore(directory).get(project.id)).ruleConfigurations).toEqual(ruleConfigurations)
    await store.update({ ...project, name: 'Renamed without replacing policy' })
    expect((await store.get(project.id)).ruleConfigurations).toEqual(ruleConfigurations)
  })
  it('keeps impact choices with their stable rule IDs across reloads', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'catalog-impact-'))
    directories.push(directory)
    const store = new ProjectStore(directory)
    const project = await store.create({ name: 'Any data set' })
    const rulesText = 'Flag rows with a missing email.'
    const ruleId = parseSourceRules(rulesText)[0]!.id
    await store.update({ ...project, rulesText, ruleImpacts: { [ruleId]: 'large' } })
    expect((await store.get(project.id)).ruleImpacts).toEqual({ [ruleId]: 'large' })
    const { ruleImpacts: _previousChoices, ...legacyUpdate } = project
    await store.update({ ...legacyUpdate, rulesText })
    expect((await store.get(project.id)).ruleImpacts).toEqual({ [ruleId]: 'large' })
  })

  it('updates name and description without changing rules, mappings, workbook or project identity', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'catalog-impact-'))
    directories.push(directory)
    const store = new ProjectStore(directory)
    const project = await store.create({ name: 'Before' })
    const rulesText = 'Flag rows with a missing email.'
    const ruleId = parseSourceRules(rulesText)[0]!.id
    const original = await store.update({ ...project, rulesText, ruleImpacts: { [ruleId]: 'large' }, columnMappings: { email: 'email' }, sourceFilePath: 'C:\\data\\source.xlsx', selectedSheet: 'Records' })
    await store.updateDetails(updateProjectDetailsInputSchema.parse({ id: project.id, name: ' After ', description: ' Renamed ', rulesText: 'Do not save this' }))
    expect(await store.list()).toHaveLength(1)
    expect(await store.get(project.id)).toEqual({ ...original, rulesText: `${rulesText}\n`, name: 'After', description: 'Renamed', updatedAt: expect.any(String) })
  })
})
