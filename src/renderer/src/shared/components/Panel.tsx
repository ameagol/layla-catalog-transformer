import type { ReactNode } from 'react'

interface PanelProps {
  children: ReactNode
  title?: string
  description?: string
  aside?: ReactNode
  className?: string
}

export function Panel({ children, title, description, aside, className = '' }: PanelProps) {
  return (
    <section
      className={`rounded-[22px] border border-[var(--line)] bg-[var(--surface)] shadow-[var(--shadow-tight)] ${className}`}
    >
      {(title || description || aside) && (
        <header className="flex items-start justify-between gap-6 border-b border-[var(--line)] px-6 py-5">
          <div>
            {title && <h2 className="font-['Fraunces_Variable'] text-xl font-semibold tracking-[-0.02em]">{title}</h2>}
            {description && <p className="mt-1 max-w-3xl text-sm leading-6 text-[var(--ink-soft)]">{description}</p>}
          </div>
          {aside}
        </header>
      )}
      {children}
    </section>
  )
}

