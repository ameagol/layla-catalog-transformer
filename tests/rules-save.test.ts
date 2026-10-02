import { afterEach, describe, expect, it, vi } from 'vitest'

import { ruleLabel } from '../src/renderer/src/features/rules/helper'
import { rulesService } from '../src/renderer/src/features/rules/service'
import { workflowCompilation, workflowProject, workflowWorkbook } from './workflow-fixtures'

afterEach(() => vi.unstubAllGlobals())

describe('validate and save', () => {
  it('interprets the current source with selected mappings before saving both', async () => {
    const project = workflowProject({ columnMappings: { email: 'email' } })
    const compilation = workflowCompilation(project.rulesText, project.columnMappings)
    const calls: string[] = []
    const interpretRules = vi.fn(async () => { calls.push('interpret'); return compilation })
    const updateProject = vi.fn(async () => { calls.push('save'); return project })
    vi.stubGlobal('window', { catalogTransformer: { interpretRules, updateProject } })
    expect(await rulesService.validateAndSave(project, workflowWorkbook())).toEqual({ compilation, project })
    expect(calls).toEqual(['interpret', 'save'])
    expect(interpretRules).toHaveBeenCalledWith(expect.objectContaining({ rulesText: project.rulesText, columnMappings: { email: 'email' }, sessionId: workflowWorkbook().sessionId }))
    expect(updateProject).toHaveBeenCalledWith(expect.objectContaining({ rulesText: project.rulesText, columnMappings: { email: 'email' }, sourceFilePath: project.sourceFilePath }))
  })

  it('retains invalid drafts without saving even if another rule can run', async () => {
    const project = workflowProject({ rulesText: 'Flag rows with a missing email.\n\nPredict next year sales using a crystal ball.' })
    const compilation = workflowCompilation(project.rulesText)
    const updateProject = vi.fn()
    vi.stubGlobal('window', { catalogTransformer: { interpretRules: vi.fn().mockResolvedValue(compilation), updateProject } })
    expect(compilation.canRun).toBe(true)
    expect((await rulesService.validateAndSave(project, workflowWorkbook())).project).toBeNull()
    expect(updateProject).not.toHaveBeenCalled()
  })

  it('allows an empty rule source to be saved to remove previous rules', async () => {
    const project = workflowProject({ rulesText: '' })
    const updateProject = vi.fn().mockResolvedValue(project)
    vi.stubGlobal('window', { catalogTransformer: { interpretRules: vi.fn().mockResolvedValue(workflowCompilation('')), updateProject } })
    expect((await rulesService.validateAndSave(project, null)).project).toEqual(project)
    expect(updateProject).toHaveBeenCalledWith(expect.objectContaining({ rulesText: '' }))
  })

  it('does not save after interpretation errors and propagates persistence errors', async () => {
    const interpretRules = vi.fn().mockRejectedValue(new Error('Interpretation unavailable'))
    const updateProject = vi.fn().mockRejectedValue(new Error('Disk full'))
    vi.stubGlobal('window', { catalogTransformer: { interpretRules, updateProject } })
    await expect(rulesService.validateAndSave(workflowProject(), workflowWorkbook())).rejects.toThrow('Interpretation unavailable')
    expect(updateProject).not.toHaveBeenCalled()
    interpretRules.mockResolvedValue(workflowCompilation())
    await expect(rulesService.validateAndSave(workflowProject(), workflowWorkbook())).rejects.toThrow('Disk full')
  })
})

describe('minimal rule labels', () => {
  it('shows orange duplicate and red missing labels without a Valid status badge', () => {
    const duplicate = workflowCompilation('Consider customers duplicates when their name and phone are equal.').interpretations[0]!
    expect(ruleLabel(duplicate, [])).toEqual({ text: 'Check Duplicate', tone: 'duplicate' })
    expect(ruleLabel(workflowCompilation().interpretations[0]!, [])).toEqual({ text: 'Check Missing', tone: 'danger' })
    const validation = workflowCompilation('Brazilian phone numbers must contain a valid DDD.').interpretations[0]!
    expect(validation.status).toBe('valid')
    expect(ruleLabel(validation, [])).toBeNull()
  })

  it('shows only Invalid for unsupported rules, missing mappings and compilation issues', () => {
    const interpretation = workflowCompilation().interpretations[0]!
    expect(ruleLabel({ ...interpretation, status: 'needs_mapping' }, [])).toEqual({ text: 'Invalid', tone: 'danger' })
    expect(ruleLabel({ ...interpretation, status: 'unsupported' }, [])).toEqual({ text: 'Invalid', tone: 'danger' })
    expect(ruleLabel(interpretation, [{ ruleId: interpretation.id, code: 'INVALID_RULE', message: 'Invalid plan' }])).toEqual({ text: 'Invalid', tone: 'danger' })
  })
})
