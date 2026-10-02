import ExcelJS from 'exceljs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { analyzeDataset } from '../src/core/engine/analyze'
import { consolidateFindings } from '../src/core/findings/consolidate'
import { compileRules } from '../src/core/rules/compiler'
import { parseSourceRules } from '../src/core/rules/source'
import { reviewedDatasetWorkbook, REVIEW_EXPORT_COLORS } from '../src/main/services/reviewedWorkbook'
import { FindingsList } from '../src/renderer/src/features/findings/FindingsList'
import { SourceRowViewer } from '../src/renderer/src/features/findings/SourceRowViewer'
import { RuleInterpretation } from '../src/renderer/src/features/rules/RuleInterpretation'
import { referenceDataset } from './business-rule-fixtures'
import { workflowWorkbook } from './workflow-fixtures'

const dataset = referenceDataset('Input', [{ Name: 'Alice' }])
const compilation = compileRules(parseSourceRules('Title: Column presence. Rule: Check if the VAT ID column exists Flag: high Action: Ask the data steward to add the VAT ID column.'), dataset.profile)

async function analyzeColumns() {
  return analyzeDataset({ projectId: 'schema', sessionId: 'schema', sheetName: 'Input', compilation, rows: dataset.rows })
}

describe('worksheet-level findings', () => {
  it('does not demand a mapping to a nonexistent column before reporting its absence', () => {
    expect(compilation.canRun).toBe(true)
    const markup = renderToStaticMarkup(createElement(RuleInterpretation, {
      interpretation: compilation.interpretations[0]!, index: 0, issues: compilation.issues,
      workbook: workflowWorkbook({ selectedSheet: dataset.profile }), mappings: {}, disabled: false,
      onMapping: () => undefined, onConfiguration: () => undefined
    }))
    expect(markup).toContain('Not present — will be reported as a worksheet issue.')
    expect(markup).toContain('Use the named header; report it if absent')
  })

  it('shows the missing header and action instead of an empty row viewer', async () => {
    const analysis = await analyzeColumns()
    const groups = consolidateFindings(analysis.findings)
    const markup = renderToStaticMarkup(createElement(SourceRowViewer, { analysisId: analysis.id, finding: groups[0]! }))
    expect(markup).toContain('Missing worksheet column')
    expect(markup).toContain('VAT ID')
    expect(markup).toContain('High priority')
    expect(markup).toContain('Ask the data steward to add the VAT ID column.')
    expect(markup).not.toContain('Loading source rows')
    const list = renderToStaticMarkup(createElement(FindingsList, { findings: groups, selectedId: groups[0]!.id, onSelect: () => undefined }))
    expect(list).toContain('Worksheet column: VAT ID')
    expect(list).not.toContain('Affected Rows')
  })

  it('exports worksheet actions separately without inventing source columns or red cells', async () => {
    const analysis = await analyzeColumns()
    const output = reviewedDatasetWorkbook(dataset.profile.columns, dataset.rows, analysis.findings, [])
    const reopened = new ExcelJS.Workbook()
    await reopened.xlsx.load(await output.xlsx.writeBuffer())
    const accepted = reopened.getWorksheet('Accepted rows')!
    const issues = reopened.getWorksheet('Worksheet issues')!
    expect(accepted.getCell('A2').value).toBe('Alice')
    expect(accepted.getCell('A2').font.color?.argb).not.toBe(REVIEW_EXPORT_COLORS.errorText)
    expect(accepted.getRow(1).values).not.toContain('VAT ID')
    expect(issues.getRow(2).values).toEqual([undefined, 'Input', 'VAT ID', 'High', analysis.findings[0]!.explanation, 'Ask the data steward to add the VAT ID column.', compilation.interpretations[0]!.sourceText])
    expect(issues.getCell('B2').font.color?.argb).toBe(REVIEW_EXPORT_COLORS.errorText)
    expect(issues.views[0]).toMatchObject({ state: 'frozen', ySplit: 1 })
  })
})
