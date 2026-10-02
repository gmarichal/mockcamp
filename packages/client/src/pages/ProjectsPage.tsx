import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, FolderOpen, Users, Layers, MoreHorizontal, Trash2, Pencil } from 'lucide-react'
import { useProjects, useCreateProject, useUpdateProject, useDeleteProject } from '@/hooks/useProjects'
import { Modal } from '@/components/Modal'
import type { Project } from '@/types'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function slugify(name: string) {
  return name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').slice(0, 64)
}

// ─── Project Form ─────────────────────────────────────────────────────────────

type ProjectFormProps = {
  onClose: () => void
  initial?: Partial<Project>
}

function ProjectForm({ onClose, initial }: ProjectFormProps) {
  const [name, setName] = useState(initial?.name ?? '')
  const [slug, setSlug] = useState(initial?.slug ?? '')
  const [desc, setDesc] = useState(initial?.description ?? '')
  const [slugTouched, setSlugTouched] = useState(!!initial?.slug)
  const [error, setError] = useState('')
  const isEdit = !!initial?.id
  const create = useCreateProject()
  const update = useUpdateProject(initial?.id ?? '')

  const handleNameChange = (v: string) => {
    setName(v)
    if (!slugTouched) setSlug(slugify(v))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!slug.match(/^[a-z0-9-]+$/)) {
      setError('Slug must be lowercase letters, numbers and hyphens only')
      return
    }
    try {
      if (isEdit) {
        await update.mutateAsync({ name, slug, description: desc || undefined })
      } else {
        await create.mutateAsync({ name, slug, description: desc || undefined })
      }
      onClose()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      setError(msg || `Failed to ${isEdit ? 'update' : 'create'} project`)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Field label="Project name">
        <input
          autoFocus
          value={name}
          onChange={e => handleNameChange(e.target.value)}
          placeholder="Payments API"
          required
        />
      </Field>

      <Field label="Slug" hint={`Accessible at /${slug || 'my-project'}/...`}>
        <input
          value={slug}
          onChange={e => { setSlugTouched(true); setSlug(e.target.value) }}
          placeholder="payments-api"
          required
          pattern="[a-z0-9-]+"
        />
      </Field>

      <Field label="Description (optional)">
        <input
          value={desc}
          onChange={e => setDesc(e.target.value)}
          placeholder="Brief description of this mock project"
        />
      </Field>

      {error && (
        <p className="text-xs px-3 py-2 rounded-md" style={{ background: 'rgba(245,101,101,0.1)', color: 'var(--error)' }}>
          {error}
        </p>
      )}

      <div className="flex justify-end gap-2 pt-1">
        <button
          type="button" onClick={onClose}
          className="px-3 py-1.5 rounded-md text-xs font-medium"
          style={{ background: 'var(--bg-hover)', color: 'var(--text-secondary)', border: '1px solid var(--border-strong)' }}
        >
          Cancel
        </button>
        <button
          type="submit" disabled={create.isPending || update.isPending}
          className="px-3 py-1.5 rounded-md text-xs font-medium disabled:opacity-60"
          style={{ background: 'var(--accent)', color: '#0F1117' }}
        >
          {(create.isPending || update.isPending)
            ? (isEdit ? 'Saving…' : 'Creating…')
            : (isEdit ? 'Save changes' : 'Create project')}
        </button>
      </div>
    </form>
  )
}

// ─── Field component ─────────────────────────────────────────────────────────

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactElement }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>{label}</label>
      {React.cloneElement(children, {
        className: 'rounded-md px-3 py-2 text-sm outline-none w-full',
        style: {
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-strong)',
          color: 'var(--text-primary)',
        },
        onFocus: (e: React.FocusEvent<HTMLInputElement>) => (e.target.style.borderColor = 'var(--accent)'),
        onBlur: (e: React.FocusEvent<HTMLInputElement>) => (e.target.style.borderColor = 'var(--border-strong)'),
      })}
      {hint && <p className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>{hint}</p>}
    </div>
  )
}

// ─── Project Card ─────────────────────────────────────────────────────────────

function ProjectCard({ project, onEdit }: { project: Project; onEdit: () => void }) {
  const navigate = useNavigate()
  const del = useDeleteProject()
  const [menuOpen, setMenuOpen] = useState(false)

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm(`Delete project "${project.name}"? This will remove all paths, resources and responses.`)) return
    await del.mutateAsync(project.id)
    setMenuOpen(false)
  }

  return (
    <div
      className="relative rounded-lg p-4 cursor-pointer transition-colors"
      style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}
      onMouseEnter={e => ((e.currentTarget as HTMLElement).style.borderColor = 'var(--border-strong)')}
      onMouseLeave={e => ((e.currentTarget as HTMLElement).style.borderColor = 'var(--border)')}
      onClick={() => navigate(`/projects/${project.id}/resources`)}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-2">
        <div>
          <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{project.name}</p>
          <p className="text-xs font-mono mt-0.5" style={{ color: 'var(--accent)' }}>/{project.slug}</p>
        </div>
        <button
          onClick={e => { e.stopPropagation(); setMenuOpen(v => !v) }}
          className="p-1 rounded"
          style={{ color: 'var(--text-muted)' }}
        >
          <MoreHorizontal size={14} />
        </button>
      </div>

      {/* Description */}
      {project.description && (
        <p className="text-xs mb-3 line-clamp-2" style={{ color: 'var(--text-secondary)' }}>
          {project.description}
        </p>
      )}

      {/* Stats */}
      <div className="flex gap-3 mt-2">
        <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--text-muted)' }}>
          <FolderOpen size={11} /> {project._count.paths} paths
        </span>
        <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--text-muted)' }}>
          <Users size={11} /> {project._count.projectRoles} members
        </span>
      </div>

      {/* Dropdown menu */}
      {menuOpen && (
        <div
          className="absolute right-3 top-10 z-10 rounded-lg py-1 shadow-xl"
          style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-strong)', minWidth: 140 }}
          onClick={e => e.stopPropagation()}
        >
          <button
            onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onEdit() }}
            className="flex items-center gap-2 w-full px-3 py-2 text-xs text-left"
            style={{ color: 'var(--text-secondary)' }}
            onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)')}
            onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = 'transparent')}
          >
            <Pencil size={12} /> Edit
          </button>
          <button
            onClick={handleDelete}
            className="flex items-center gap-2 w-full px-3 py-2 text-xs text-left"
            style={{ color: 'var(--error)' }}
            onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)')}
            onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = 'transparent')}
          >
            <Trash2 size={12} /> Delete
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

import React from 'react'

export function ProjectsPage() {
  const { data: projects, isLoading } = useProjects()
  const [showCreate, setShowCreate] = useState(false)
  const [editProject, setEditProject] = useState<Project | null>(null)

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <h1 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Projects</h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
            Each project exposes mock endpoints under its slug prefix.
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium"
          style={{ background: 'var(--accent)', color: '#0F1117' }}
        >
          <Plus size={13} /> New project
        </button>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Loading…</div>
      )}

      {/* Empty state */}
      {!isLoading && (!projects || projects.length === 0) && (
        <div
          className="flex flex-col items-center justify-center rounded-lg py-16 text-center"
          style={{ border: '1px dashed var(--border-strong)' }}
        >
          <div
            className="flex items-center justify-center rounded-lg mb-4"
            style={{ width: 44, height: 44, background: 'var(--bg-elevated)', border: '1px solid var(--border-strong)' }}
          >
            <Layers size={20} style={{ color: 'var(--accent)' }} />
          </div>
          <p className="text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>No projects yet</p>
          <p className="text-xs mb-4" style={{ color: 'var(--text-secondary)' }}>
            Create your first project to start mocking APIs.
          </p>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium"
            style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-strong)', color: 'var(--text-primary)' }}
          >
            <Plus size={13} /> New project
          </button>
        </div>
      )}

      {/* Project grid */}
      {projects && projects.length > 0 && (
        <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
          {projects.map(p => (
            <ProjectCard key={p.id} project={p} onEdit={() => setEditProject(p)} />
          ))}
        </div>
      )}

      {/* Create modal */}
      {showCreate && (
        <Modal title="New project" onClose={() => setShowCreate(false)}>
          <ProjectForm onClose={() => setShowCreate(false)} />
        </Modal>
      )}

      {/* Edit modal — placeholder for now, same form */}
      {editProject && (
        <Modal title="Edit project" onClose={() => setEditProject(null)}>
          <ProjectForm onClose={() => setEditProject(null)} initial={editProject} />
        </Modal>
      )}
    </div>
  )
}
