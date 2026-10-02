import { AlertTriangle, X } from 'lucide-react'

interface ErrorBannerProps {
  message: string
  onDismiss: () => void
}

export function ErrorBanner({ message, onDismiss }: ErrorBannerProps) {
  return (
    <div className="mb-5 flex items-start gap-3 rounded-2xl border border-[var(--danger)]/35 bg-[var(--danger-soft)] px-4 py-3 text-[var(--danger)] shadow-[var(--shadow-tight)]">
      <AlertTriangle className="mt-0.5 size-5 shrink-0" />
      <p className="flex-1 text-sm font-semibold leading-6">{message}</p>
      <button aria-label="Dismiss error" className="rounded-lg p-1 transition hover:bg-black/5" onClick={onDismiss}>
        <X className="size-4" />
      </button>
    </div>
  )
}

