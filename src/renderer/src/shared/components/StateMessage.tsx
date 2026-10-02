import type { ReactNode } from 'react'
import { LoaderCircle } from 'lucide-react'

interface StateMessageProps {
  title: string
  description: string
  icon?: ReactNode
  action?: ReactNode
  loading?: boolean
}

export function StateMessage({ title, description, icon, action, loading = false }: StateMessageProps) {
  return (
    <div className="flex min-h-72 flex-col items-center justify-center px-8 py-14 text-center">
      <div className="grid size-14 place-items-center rounded-2xl border border-[var(--line)] bg-[var(--surface-raised)] text-[var(--ink-soft)] shadow-[var(--shadow-tight)]">
        {loading ? <LoaderCircle className="size-6 animate-spin" /> : icon}
      </div>
      <h3 className="mt-5 font-['Fraunces_Variable'] text-2xl font-semibold tracking-[-0.025em]">{title}</h3>
      <p className="mt-2 max-w-lg text-sm leading-6 text-[var(--ink-soft)]">{description}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  )
}

