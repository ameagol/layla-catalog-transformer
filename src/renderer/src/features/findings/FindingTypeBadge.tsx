import type { CSSProperties } from 'react'

import type { FindingType } from '@core/model/domain'

import { findingTypeLabel } from './helper'
import { FINDING_COLORS } from '@/styles/theme'

export function FindingTypeBadge({ type }: { type: FindingType }) {
  const colors = FINDING_COLORS[type]
  return <span style={{ '--finding-ink': colors.ink, '--finding-fill': colors.fill } as CSSProperties} className="inline-flex max-w-full rounded-md border border-[var(--finding-ink)]/25 bg-[var(--finding-fill)] px-2 py-1 text-xs font-semibold leading-4 text-[var(--finding-ink)]">{findingTypeLabel(type)}</span>
}
