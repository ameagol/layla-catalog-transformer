import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { RULE_EXAMPLES } from '../src/renderer/src/features/rules/constants'
import { RulesScreen } from '../src/renderer/src/features/rules/RulesScreen'

vi.mock('../src/renderer/src/stores/useAppStore', () => ({
  useAppStore: (select: (state: Record<string, unknown>) => unknown) => select({
    currentProject: { rulesText: '', disabledRuleIds: [] }, busyAction: null, workbook: null, compilation: null,
    updateProjectDraft: () => undefined, validateAndSaveRules: () => undefined,
    toggleRule: () => undefined, setColumnMapping: () => undefined, setRuleConfiguration: () => undefined
  })
}))

describe('rule textarea examples', () => {
  it('shows five faint examples as a placeholder, never as saved rule text', () => {
    const markup = renderToStaticMarkup(createElement(RulesScreen))
    expect(RULE_EXAMPLES).toHaveLength(5)
    for (const example of RULE_EXAMPLES) expect(markup).toContain(example)
    expect(markup).toContain('placeholder:font-light')
    expect(markup).toContain('placeholder:opacity-40')
    expect(markup).toContain('focus:placeholder:opacity-0')
    expect(markup).toMatch(/placeholder="[^"]+"><\/textarea>/u)
    expect(markup).toContain('0 rules')
    expect(markup).not.toContain('Reference-dependent')
  })
})
