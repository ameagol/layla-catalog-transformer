import type { ReactNode } from 'react'

interface PageHeaderProps {
  eyebrow: string
  title: string
  description: string
  actions?: ReactNode
}

export function PageHeader({ eyebrow, title, description, actions }: PageHeaderProps) {
  return (
    <header className="mb-7 flex items-end justify-between gap-8 animate-[rise-in_420ms_ease-out_both]">
      <div className="max-w-3xl">
        <p className="font-['JetBrains_Mono_Variable'] text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--signal)]">
          {eyebrow}
        </p>
        <h1 className="mt-2 font-['Fraunces_Variable'] text-[42px] font-semibold leading-[1.02] tracking-[-0.045em] text-[var(--ink)]">
          {title}
        </h1>
        <p className="mt-3 max-w-2xl text-base leading-7 text-[var(--ink-soft)]">{description}</p>
      </div>
      {actions && <div className="flex shrink-0 items-center gap-3">{actions}</div>}
    </header>
  )
}

