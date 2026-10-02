import { writeFile } from 'node:fs/promises'

export async function verifyRuleExamples(window: Electron.BrowserWindow, screenshotPath?: string): Promise<void> {
  const protocol = window.webContents.debugger
  protocol.attach('1.3')
  try {
    await protocol.sendCommand('Emulation.setFocusEmulationEnabled', { enabled: true })
    await checkRuleExamples(window, screenshotPath)
  } finally {
    try {
      await protocol.sendCommand('Emulation.setFocusEmulationEnabled', { enabled: false })
    } finally {
      protocol.detach()
    }
  }
}

async function checkRuleExamples(window: Electron.BrowserWindow, screenshotPath?: string): Promise<void> {
  const initial = await window.webContents.executeJavaScript(`(async () => {
    document.querySelector('a[href$="/rules"]')?.click();
    for (let attempt = 0; attempt < 60; attempt += 1) {
      const input = document.querySelector('textarea[aria-label="Natural-language rules"]');
      if (input && !input.disabled) {
        input.blur();
        return { count: input.placeholder.split('\\n').length, value: input.value, opacity: getComputedStyle(input, '::placeholder').opacity };
      }
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    throw new Error('Rule textarea did not appear.');
  })()`) as { count: number; value: string; opacity: string }
  if (initial.count !== 5 || initial.value !== '' || Number(initial.opacity) <= 0 || Number(initial.opacity) > 0.5) throw new Error('The rule textarea must display five faint placeholder examples without adding actual rules.')
  await new Promise((resolve) => setTimeout(resolve, 500))
  if (screenshotPath) await writeFile(screenshotPath.replace(/\.png$/u, '-rules.png'), (await window.capturePage()).toPNG())
  const focused = await window.webContents.executeJavaScript(`(async () => {
    const input = document.querySelector('textarea[aria-label="Natural-language rules"]');
    input.focus();
    await new Promise(resolve => setTimeout(resolve, 150));
    return { active: document.activeElement === input, placeholder: input.placeholder };
  })()`) as { active: boolean; placeholder: string }
  if (!focused.active || focused.placeholder !== '') throw new Error(`Rule examples must disappear when the textarea receives focus: ${JSON.stringify(focused)}`)
  if (screenshotPath) await writeFile(screenshotPath.replace(/\.png$/u, '-rules-focused.png'), (await window.capturePage()).toPNG())
  const restored = await window.webContents.executeJavaScript(`(async () => {
    const input = document.querySelector('textarea[aria-label="Natural-language rules"]');
    input.blur();
    await new Promise(resolve => setTimeout(resolve, 150));
    return { value: input.value, count: input.placeholder.split('\\n').length, opacity: getComputedStyle(input, '::placeholder').opacity };
  })()`) as { value: string; count: number; opacity: string }
  if (restored.value !== '' || restored.count !== 5 || Number(restored.opacity) <= 0) throw new Error('Empty rule input must retain its placeholder after blur.')
  console.log('RULE_PLACEHOLDERS_SMOKE_OK: five faint examples; hidden on focus; restored on blur; no input text inserted.')
}
