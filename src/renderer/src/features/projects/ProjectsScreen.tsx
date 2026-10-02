import { useState } from 'react'
import { FolderPlus, Trash2 } from 'lucide-react'

import { PROJECT_COPY } from './constants'
import { formatProjectDate } from './helper'
import { ProjectForm } from './ProjectForm'
import { useAppStore } from '@/stores/useAppStore'
import { ActionButton } from '@/shared/components/ActionButton'
import { PageHeader } from '@/shared/components/PageHeader'
import { Panel } from '@/shared/components/Panel'
import { StateMessage } from '@/shared/components/StateMessage'

export function ProjectsScreen() {
  const [creating, setCreating] = useState(false)
  const projects = useAppStore((state) => state.projects)
  const currentProject = useAppStore((state) => state.currentProject)
  const busy = useAppStore((state) => Boolean(state.busyAction))
  const deleteProject = useAppStore((state) => state.deleteProject)
  const selectProject = useAppStore((state) => state.selectProject)

  return (
    <div className="animate-[rise-in_420ms_ease-out_both]">
      <PageHeader {...PROJECT_COPY} actions={<ActionButton type="button" icon={<FolderPlus className="size-4" />} disabled={busy || creating || !currentProject} onClick={() => setCreating(true)}>New project</ActionButton>} />
      <div className="grid grid-cols-[minmax(0,7fr)_minmax(0,3fr)] items-stretch gap-6">
        <ProjectForm key={creating ? 'new' : currentProject?.id ?? 'new'} project={creating ? null : currentProject} onCreated={() => setCreating(false)} />
        <Panel title="Local workspaces" description="Your projects on this computer." className="flex h-[500px] min-w-0 flex-col overflow-hidden">
          <div className="min-h-0 flex-1 overflow-y-auto">
            {projects.length === 0 ? (
              <StateMessage icon={<FolderPlus className="size-6" />} title="No projects yet" description="Create a project using the form on the left." />
            ) : (
              <ul className="divide-y divide-[var(--line)]">
                {projects.map((project) => (
                  <li key={project.id} className={`flex items-start gap-2 px-4 py-4 ${project.id === currentProject?.id ? 'bg-[var(--surface-muted)] shadow-[inset_3px_0_0_var(--signal)]' : ''}`}>
                    <button type="button" disabled={busy} aria-pressed={project.id === currentProject?.id} className="min-w-0 flex-1 text-left disabled:cursor-wait" onClick={() => { setCreating(false); if (project.id !== currentProject?.id) void selectProject(project.id) }}>
                      <span className="block break-words font-['Fraunces_Variable'] text-lg font-semibold leading-6">{project.name}</span>
                      {project.description && <span className="mt-1 block line-clamp-2 text-xs leading-5 text-[var(--ink-soft)]">{project.description}</span>}
                      <span className="mt-2 block text-[11px] leading-5 text-[var(--ink-soft)]">{formatProjectDate(project.updatedAt)}</span>
                      {project.id === currentProject?.id && <span className="mt-1 block text-xs font-semibold text-[var(--success)]">Active project</span>}
                    </button>
                    <button type="button" disabled={busy} aria-label={`Delete ${project.name}`} className="shrink-0 rounded-lg p-2 text-[var(--ink-soft)] transition hover:bg-[var(--danger-soft)] hover:text-[var(--danger)] disabled:opacity-40" onClick={() => void deleteProject(project.id)}><Trash2 className="size-4" /></button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Panel>
      </div>
    </div>
  )
}
