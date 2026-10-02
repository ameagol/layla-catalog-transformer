import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { interpretRules } from '../src/core/rules/interpreter'
import { RuleInterpretation } from '../src/renderer/src/features/rules/RuleInterpretation'
import { RowActionItems } from '../src/renderer/src/features/findings/RowActionItems'
import { RowDecisionActions } from '../src/renderer/src/features/findings/RowDecisionActions'
import { businessContext, businessProfile, businessRules } from './business-rule-fixtures'
import { workflowWorkbook } from './workflow-fixtures'

describe('rule mapping and row review UI', () => {
  it('renders the mapped rule with named columns, priority and editable action item', () => {
    const interpretation = interpretRules([businessRules[0]!], businessProfile, {}, businessContext)[0]!
    const markup = renderToStaticMarkup(createElement(RuleInterpretation, {
      interpretation, index: 0, issues: [], workbook: { ...workflowWorkbook(), selectedSheet: businessProfile },
      mappings: {}, disabled: false, onMapping: () => undefined, onConfiguration: () => undefined
    }))
    expect(markup).toContain('<tr')
    expect(markup).toContain('Column for SFDC Veg Owner in rule 1')
    expect(markup).toContain('Priority for rule 1')
    expect(markup).toContain('Action item for rule 1')
    expect(markup).toContain('Commercial Data Steward')
  })
  it('renders per-row actions and acceptance without implying issues were corrected', () => {
    const actions = renderToStaticMarkup(createElement(RowActionItems, { items: [{ ruleId: 'rule-test', priority: 'medium_high', actionItem: 'Route to the owner.', explanation: 'Missing email.' }] }))
    expect(actions).toContain('Medium / High')
    expect(actions).toContain('Route to the owner.')
    expect(actions).toContain('Missing email.')
    const buttons = renderToStaticMarkup(createElement(RowDecisionActions, { analysisId: 'analysis-test', rowNumber: 7, decision: 'accept' }))
    expect(buttons).toContain('Accept row 7')
    expect(buttons).toContain('Exclude row 7')
    expect(buttons).toContain('Included; issues stay marked')
  })
})
