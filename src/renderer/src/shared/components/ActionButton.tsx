import type { ButtonHTMLAttributes, ReactNode } from 'react'

interface ActionButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  tone?: 'primary' | 'secondary' | 'quiet' | 'danger'
  icon?: ReactNode
}

export function ActionButton({ tone = 'secondary', icon, children, className = '', ...props }: ActionButtonProps) {
  const toneClasses =
    tone === 'primary'
      ? 'border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-ink)] hover:-translate-y-0.5 hover:shadow-[var(--shadow-tight)]'
      : tone === 'danger'
        ? 'border-[var(--danger)] bg-[var(--danger)] text-white hover:-translate-y-0.5'
        : tone === 'quiet'
          ? 'border-transparent bg-transparent text-[var(--ink-soft)] hover:bg-[var(--surface-muted)] hover:text-[var(--ink)]'
          : 'border-[var(--line)] bg-[var(--surface-raised)] text-[var(--ink)] hover:-translate-y-0.5 hover:border-[var(--line-strong)] hover:shadow-[var(--shadow-tight)]'

  return (
    <button
      className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold transition duration-200 disabled:cursor-not-allowed disabled:opacity-45 ${toneClasses} ${className}`}
      {...props}
    >
      {icon}
      {children}
    </button>
  )
}

