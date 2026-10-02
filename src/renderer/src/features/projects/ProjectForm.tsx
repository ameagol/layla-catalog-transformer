import { useState, type FormEvent } from 'react'
import { FolderPlus, Save } from 'lucide-react'

import type { ProjectRecord } from '@core/model/domain'

import { useAppStore } from '@/stores/useAppStore'
import { ActionButton } from '@/shared/components/ActionButton'
import { Panel } from '@/shared/components/Panel'

interface ProjectFormProps {
  project: ProjectRecord | null
  onCreated: () => void
}

export function ProjectForm({ project, onCreated }: ProjectFormProps) {
  const [name, setName] = useState(project?.name ?? '')
  const [description, setDescription] = useState(project?.description ?? '')
  const [saved, setSaved] = useState(false)
  const busy = useAppStore((state) => Boolean(state.busyAction))
  const createProject = useAppStore((state) => state.createProject)
  const saveProjectDetails = useAppStore((state) => state.saveProjectDetails)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!name.trim() || busy) return
    const details = { name: name.trim(), description: description.trim() }
    if (project) {
      if (await saveProjectDetails({ id: project.id, ...details })) {
        setName(details.name)
        setDescription(details.description)
        setSaved(true)
      }
    } else if (await createProject(details)) {
      onCreated()
    }
  }

  return (
    <Panel title={project ? 'Edit project' : 'Create project'} description={project ? 'Update this workspace’s name and description.' : 'Start with a blank workspace for your dataset and rules.'} className="flex h-[500px] min-w-0 flex-col overflow-hidden">
      <form className="flex min-h-0 flex-1 flex-col gap-5 p-6" onSubmit={(event) => void submit(event)}>
        <label className="block text-sm font-semibold">
          Name
          <input required maxLength={100} autoComplete="off" disabled={busy} className="mt-2 w-full rounded-xl border border-[var(--line)] bg-[var(--surface-raised)] px-3.5 py-3 outline-none transition focus:border-[var(--aqua)]" placeholder="Project name" value={name} onChange={(event) => { setName(event.target.value); setSaved(false) }} />
        </label>
        <label className="flex min-h-0 flex-1 flex-col text-sm font-semibold">
          Description
          <textarea maxLength={500} disabled={busy} className="mt-2 min-h-24 w-full flex-1 resize-none rounded-xl border border-[var(--line)] bg-[var(--surface-raised)] px-3.5 py-3 leading-6 outline-none transition focus:border-[var(--aqua)]" placeholder="What will this project check?" value={description} onChange={(event) => { setDescription(event.target.value); setSaved(false) }} />
        </label>
        <div className="flex items-center gap-4">
          <ActionButton type="submit" tone="primary" icon={project ? <Save className="size-4" /> : <FolderPlus className="size-4" />} disabled={!name.trim() || busy}>{project ? 'Save Project' : 'Create Project'}</ActionButton>
          {saved && <p role="status" className="text-xs font-semibold text-[var(--success)]">Project saved.</p>}
        </div>
      </form>
    </Panel>
  )
}
