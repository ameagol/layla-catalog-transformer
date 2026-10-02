import type { CatalogTransformerApi } from '@core/ipc/contracts'

declare global {
  interface Window {
    catalogTransformer: CatalogTransformerApi
  }
}

export {}

