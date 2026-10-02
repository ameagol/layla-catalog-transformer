import {
  AlertCircle,
  Database,
  FileSearch,
  FolderKanban,
  SlidersHorizontal,
  Sparkles
} from 'lucide-react'
import { NavLink, Outlet } from 'react-router-dom'

import { NAV_ITEMS } from './constants'
import { useAppStore } from '@/stores/useAppStore'
import { ErrorBanner } from '@/shared/components/ErrorBanner'
import { StateMessage } from '@/shared/components/StateMessage'

const ICONS = {
  projects: FolderKanban,
  rules: SlidersHorizontal,
  dataset: Database,
  findings: FileSearch,
}

export function AppShell() {
  const initialized = useAppStore((state) => state.initialized)
  const busyAction = useAppStore((state) => state.busyAction)
  const error = useAppStore((state) => state.error)
  const clearError = useAppStore((state) => state.clearError)
  const projects = useAppStore((state) => state.projects)
  const currentProject = useAppStore((state) => state.currentProject)
  const selectProject = useAppStore((state) => state.selectProject)
  const appVersion = useAppStore((state) => state.appVersion)

  if (!initialized) {
    return (
      <main className="grid min-h-screen place-items-center bg-[var(--paper)] text-[var(--ink)]">
        <StateMessage loading title="Opening the workbench" description="Loading your projects and Laya AI workspace." />
      </main>
    )
  }

  return (
    <div className="grid h-screen grid-cols-[264px_minmax(0,1fr)] overflow-hidden bg-[var(--paper)] text-[var(--ink)]">
      <aside className="relative flex h-screen flex-col overflow-hidden bg-[var(--rail)] px-4 py-5 text-white">
        <div className="pointer-events-none absolute inset-0 opacity-20 [background-image:linear-gradient(rgba(255,255,255,.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.05)_1px,transparent_1px)] [background-size:28px_28px]" />
        <div className="relative flex items-center gap-3 px-2">
          <div className="relative grid size-11 place-items-center overflow-hidden rounded-xl border border-white/15 bg-[var(--rail-soft)] shadow-2xl">
            <div className="absolute inset-x-0 top-0 h-1 bg-[var(--accent)]" />
            <span className="font-['Fraunces_Variable'] text-lg font-bold tracking-[-0.08em]">CT</span>
          </div>
          <div>
            <p className="font-['Fraunces_Variable'] text-lg font-semibold leading-tight">Catalog Transformer</p>
            <p className="mt-0.5 font-['JetBrains_Mono_Variable'] text-[9px] uppercase tracking-[0.18em] text-white/45">
              Local quality engine
            </p>
          </div>
        </div>

        <div className="relative mt-7 rounded-2xl border border-white/10 bg-white/[0.045] p-3">
          <label className="font-['JetBrains_Mono_Variable'] text-[9px] font-semibold uppercase tracking-[0.18em] text-white/45" htmlFor="project-switcher">
            Active project
          </label>
          <select
            id="project-switcher"
            disabled={Boolean(busyAction)}
            className="mt-2 w-full rounded-xl border border-white/10 bg-[var(--rail-soft)] px-3 py-2.5 text-sm font-semibold text-white outline-none"
            value={currentProject?.id ?? ''}
            onChange={(event) => void selectProject(event.target.value)}
          >
            {!currentProject && <option value="" disabled>Select a project</option>}
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </div>

        <nav className="relative mt-5 space-y-1.5" aria-label="Primary navigation">
          {NAV_ITEMS.map((item) => {
            const Icon = ICONS[item.icon]
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  `group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                    isActive
                      ? 'bg-[var(--accent)] text-[var(--accent-ink)] shadow-lg'
                      : 'text-white/65 hover:bg-white/[0.07] hover:text-white'
                  }`
                }
              >
                <Icon className="size-[18px]" strokeWidth={1.8} />
                {item.label}
              </NavLink>
            )
          })}
        </nav>

        <div className="relative mt-auto space-y-3">
          {busyAction && (
            <div className="flex items-center gap-2 rounded-xl border border-[var(--accent)]/25 bg-[var(--accent)]/10 px-3 py-2.5 text-xs font-semibold text-[var(--accent)]">
              <Sparkles className="size-4 animate-[pulse-track_1.2s_ease-in-out_infinite]" />
              {busyAction.replaceAll('-', ' ')}
            </div>
          )}
          <p className="px-1 font-['JetBrains_Mono_Variable'] text-[9px] uppercase tracking-[0.16em] text-white/30">
            Version {appVersion || '0.1.0'}
          </p>
        </div>
      </aside>

      <main className="relative h-screen overflow-y-auto">
        <div className="pointer-events-none absolute inset-0 opacity-[0.32] [background-image:radial-gradient(var(--line)_0.7px,transparent_0.7px)] [background-size:18px_18px]" />
        <div className="relative mx-auto max-w-[1440px] px-9 py-8">
          {!currentProject && (
            <div className="mb-5 flex items-center gap-3 rounded-2xl border border-[var(--warning)]/35 bg-[var(--warning-soft)] px-4 py-3 text-sm font-semibold text-[var(--warning)]">
              <AlertCircle className="size-5" />
              Create a project to begin.
            </div>
          )}
          {error && <ErrorBanner message={error} onDismiss={clearError} />}
          <Outlet />
        </div>
      </main>
    </div>
  )
}
