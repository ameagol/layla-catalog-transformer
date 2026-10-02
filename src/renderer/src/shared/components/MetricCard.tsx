import type { ReactNode } from 'react'

interface MetricCardProps {
  label: string
  value: string | number
  detail?: string
  icon: ReactNode
  tone?: 'default' | 'signal' | 'aqua' | 'accent'
}

export function MetricCard({ label, value, detail, icon, tone = 'default' }: MetricCardProps) {
  const iconClasses =
    tone === 'signal'
      ? 'bg-[var(--signal-soft)] text-[var(--signal)]'
      : tone === 'aqua'
        ? 'bg-[var(--aqua-soft)] text-[var(--ink)]'
        : tone === 'accent'
          ? 'bg-[var(--accent)] text-[var(--accent-ink)]'
          : 'bg-[var(--surface-muted)] text-[var(--ink-soft)]'
  return (
    <article className="rounded-[20px] border border-[var(--line)] bg-[var(--surface)] p-5 shadow-[var(--shadow-tight)]">
      <div className={`grid size-10 place-items-center rounded-xl ${iconClasses}`}>{icon}</div>
      <p className="mt-5 text-sm font-semibold text-[var(--ink-soft)]">{label}</p>
      <p className="mt-1 font-['Fraunces_Variable'] text-3xl font-semibold tracking-[-0.04em]">{value}</p>
      {detail && <p className="mt-2 text-xs leading-5 text-[var(--ink-soft)]">{detail}</p>}
    </article>
  )
}

