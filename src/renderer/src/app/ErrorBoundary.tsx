import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertOctagon } from 'lucide-react'

interface ErrorBoundaryProps {
  children: ReactNode
}

interface ErrorBoundaryState {
  error: Error | null
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Renderer error boundary', error, info)
  }

  render(): ReactNode {
    if (!this.state.error) return this.props.children
    return (
      <main className="grid min-h-screen place-items-center bg-[var(--paper)] p-10 text-[var(--ink)]">
        <section className="max-w-xl rounded-[28px] border border-[var(--danger)]/35 bg-[var(--surface)] p-8 shadow-[var(--shadow)]">
          <div className="grid size-14 place-items-center rounded-2xl bg-[var(--danger-soft)] text-[var(--danger)]">
            <AlertOctagon className="size-7" />
          </div>
          <h1 className="mt-5 font-['Fraunces_Variable'] text-3xl font-semibold">The local interface stopped unexpectedly.</h1>
          <p className="mt-3 text-sm leading-6 text-[var(--ink-soft)]">{this.state.error.message}</p>
          <button
            className="mt-6 rounded-xl bg-[var(--accent)] px-5 py-3 text-sm font-bold text-[var(--accent-ink)]"
            onClick={() => window.location.reload()}
          >
            Reload application
          </button>
        </section>
      </main>
    )
  }
}

