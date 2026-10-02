interface StatusBadgeProps {
  label: string
  tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'aqua' | 'accent'
}

export function StatusBadge({ label, tone = 'neutral' }: StatusBadgeProps) {
  const classes =
    tone === 'success'
      ? 'border-[var(--success)]/30 bg-[var(--success-soft)] text-[var(--success)]'
      : tone === 'warning'
        ? 'border-[var(--warning)]/30 bg-[var(--warning-soft)] text-[var(--warning)]'
        : tone === 'danger'
          ? 'border-[var(--danger)]/30 bg-[var(--danger-soft)] text-[var(--danger)]'
          : tone === 'aqua'
            ? 'border-[var(--aqua)]/40 bg-[var(--aqua-soft)] text-[var(--ink)]'
            : tone === 'accent'
              ? 'border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-ink)]'
              : 'border-[var(--line)] bg-[var(--surface-muted)] text-[var(--ink-soft)]'
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.12em] ${classes}`}>
      {label}
    </span>
  )
}

