import { readFile, stat } from 'node:fs/promises'
import { join } from 'node:path'

import type { Agent, PredictOptions, QuestionDef, SystemOneResult } from 'laya-ts'
import { z } from 'zod'

const modelFiles = ['encoder.onnx', 'encoder.onnx.data', 'head.onnx', 'head.onnx.data', 'tokenizer.json', 'rl_agent_config.json'] as const
const manifestSchema = z.object({
  runtimeRevision: z.literal('6d942c92081fbc139e736bbd9ac0023223c29b7f'),
  model: z.literal('convaiinnovations/laya/multilingual'),
  sha256: z.record(z.string(), z.string().regex(/^[0-9a-f]{64}$/))
})

export interface LayaPredictor {
  predict(state: unknown, questions: Record<string, QuestionDef>, options?: PredictOptions): Promise<SystemOneResult>
}

export class LayaService implements LayaPredictor {
  private agentPromise: Promise<Agent> | null = null
  private pending: Promise<unknown> = Promise.resolve()

  constructor(private readonly userDataPath: string, private readonly developmentModelPath?: string) {}

  async ready(): Promise<void> {
    await this.agent()
  }

  async predict(state: unknown, questions: Record<string, QuestionDef>, options: PredictOptions = {}): Promise<SystemOneResult> {
    const run = this.pending.then(async () => (await this.agent()).predict(state, questions, options))
    this.pending = run.catch(() => undefined)
    let timeout: ReturnType<typeof setTimeout> | undefined
    try {
      return await Promise.race([
        run,
        new Promise<never>((_, reject) => { timeout = setTimeout(() => reject(new Error('Laya AI validation timed out. No rule was approved; retry validation.')), 60_000) })
      ])
    } finally {
      clearTimeout(timeout)
    }
  }

  private agent(): Promise<Agent> {
    if (!this.agentPromise) {
      this.agentPromise = this.loadAgent().catch((error: unknown) => {
        this.agentPromise = null
        throw new Error(`Laya AI is unavailable. Install the app with its verified Laya model, then retry. Validation cannot fall back to deterministic-only checks. ${error instanceof Error ? error.message : ''}`.trim())
      })
    }
    return this.agentPromise
  }

  private async loadAgent(): Promise<Agent> {
    const candidates = [
      ...(process.resourcesPath ? [join(process.resourcesPath, 'models', 'laya-multilingual')] : []),
      ...(this.developmentModelPath ? [this.developmentModelPath] : []),
      join(this.userDataPath, 'models', 'laya-multilingual')
    ]
    for (const directory of candidates) {
      if (!await stat(join(directory, 'manifest.json')).then((entry) => entry.isFile()).catch(() => false)) continue
      const manifest = manifestSchema.parse(JSON.parse(await readFile(join(directory, 'manifest.json'), 'utf8')))
      for (const name of modelFiles) {
        if (!manifest.sha256[name]) throw new Error(`The model manifest is missing the digest for ${name}.`)
      }
      const { Agent } = await import('laya-ts')
      return Agent.load(directory, { device: 'cpu', expectedSha256: manifest.sha256 })
    }
    throw new Error('The verified model files were not found.')
  }
}
