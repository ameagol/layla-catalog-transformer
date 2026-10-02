import { describe, expect, it, vi } from 'vitest'

import { profileWorksheet } from '../src/core/dataset/profiling'
import { AnalysisService } from '../src/main/services/analysisService'
import type { ProjectStore } from '../src/main/services/projectStore'
import type { WorkbookService } from '../src/main/services/workbookService'
import { findingColumns, findingRows } from './finding-fixtures'
import { mockLayaNlp } from './laya-fixtures'

const input = {
  projectId: '00000000-0000-4000-8000-000000000001',
  sessionId: '00000000-0000-4000-8000-000000000002',
  sheetName: 'Customers', rulesText: 'Flag rows with a missing email.', disabledRuleIds: [], columnMappings: {}
}

function setup() {
  const dataset = { profile: profileWorksheet('Customers', 1, findingColumns, findingRows), rows: findingRows }
  const workbooks = { getWorksheetData: vi.fn().mockResolvedValue(dataset) }
  const projects = { get: vi.fn().mockResolvedValue({ ruleImpacts: {} }), recordAnalysis: vi.fn().mockResolvedValue(undefined) }
  const service = new AnalysisService(workbooks as unknown as WorkbookService, projects as unknown as ProjectStore, mockLayaNlp())
  return { service, workbooks, dataset }
}

describe('finding row service', () => {
  it('loads real first-column context from the active analysis worksheet', async () => {
    const { service, workbooks } = setup()
    const analysis = await service.run(input)
    const finding = analysis.findings[0]!
    const source = await service.getFindingRows(analysis.id, finding.id)
    expect(workbooks.getWorksheetData).toHaveBeenLastCalledWith(input.sessionId, 'Customers')
    expect(source.rows).toEqual([{ rowNumber: 204, values: { id: 204, name: 'Customer B', email: null } }])
    expect(source.columns.map((column) => column.affected)).toEqual([false, false, true])
  })

  it('rejects a finding outside the active analysis before accessing workbook data', async () => {
    const { service, workbooks } = setup()
    const analysis = await service.run(input)
    workbooks.getWorksheetData.mockClear()
    await expect(service.getFindingRows(analysis.id, 'finding-other')).rejects.toThrow('does not belong')
    expect(workbooks.getWorksheetData).not.toHaveBeenCalled()
  })

  it('rejects an old analysis after another run completes', async () => {
    const { service } = setup()
    const previous = await service.run(input)
    await service.run(input)
    await expect(service.getFindingRows(previous.id, previous.findings[0]!.id)).rejects.toThrow('no longer active')
  })

  it('does not return stale rows when the active analysis changes during a workbook read', async () => {
    const { service, workbooks, dataset } = setup()
    const previous = await service.run(input)
    let finishRead!: (value: typeof dataset) => void
    workbooks.getWorksheetData.mockReturnValueOnce(new Promise((resolve) => { finishRead = resolve }))
    const read = service.getFindingRows(previous.id, previous.findings[0]!.id)
    await service.run(input)
    finishRead(dataset)
    await expect(read).rejects.toThrow('no longer active')
  })

  it('propagates source file changes instead of showing mismatched values', async () => {
    const { service, workbooks } = setup()
    const analysis = await service.run(input)
    workbooks.getWorksheetData.mockRejectedValueOnce(new Error('The source workbook changed.'))
    await expect(service.getFindingRows(analysis.id, analysis.findings[0]!.id)).rejects.toThrow('source workbook changed')
  })
})
