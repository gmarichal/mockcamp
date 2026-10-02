import React, { useState } from 'react'
import { useParams } from 'react-router-dom'
import { Plus, ChevronRight, ChevronDown, FolderOpen, Folder, MoreHorizontal, Trash2, Pencil, GitBranch } from 'lucide-react'
import { usePaths, useCreatePath, useUpdatePath, useDeletePath, buildTree } from '@/hooks/usePaths'
import { Modal } from '@/components/Modal'
import type { PathNode } from '@/types'

// ─── Path Form ────────────────────────────────────────────────────────────────

type PathFormProps = {
  onClose: () => void
  projectId: string
  parentId?: string | null
  initial?: { id: string; name: string; path: string }
}

function toPathSegment(name: string) {
  return '/' + name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').replace(/^-+|-+$/g, '')
}

function PathForm({ onClose, projectId, parentId, initial }: PathFormProps) {
  const [name, setName] = useState(initial?.name ?? '')
  const [path, setPath] = useState(initial?.path ?? '/')
  const [pathTouched, setPathTouched] = useState(!!initial?.path)
  const [error, setError] = useState('')
  const create = useCreatePath(projectId)
  const update = useUpdatePath(projectId)
  const isEdit = !!initial

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!path.startsWith('/')) { setError('Path must start with /'); return }
    try {
      if (isEdit) {
        await update.mutateAsync({ pathId: initial.id, name, path })
      } else {
        await create.mutateAsync({ name, path, parentId: parentId ?? null })
      }
      onClose()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      setError(msg || `Failed to ${isEdit ? 'update' : 'create'} path`)
    }
  }

  const isPending = create.isPending || update.isPending

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Name</label>
        <input
          autoFocus
          value={name}
          onChange={e => {
            setName(e.target.value)
            if (!pathTouched) setPath(toPathSegment(e.target.value) || '/')
          }}
          placeholder="Users"
          required
          className="rounded-md px-3 py-2 text-sm outline-none"
          style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', color: 'var(--text-primary)' }}
          onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
          onBlur={e => (e.target.style.borderColor = 'var(--border-strong)')}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Path</label>
        <input
          value={path}
          onChange={e => { setPathTouched(true); setPath(e.target.value) }}
          placeholder="/users"
          required
          className="rounded-md px-3 py-2 text-sm font-mono outline-none"
          style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', color: 'var(--accent)' }}
          onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
          onBlur={e => (e.target.style.borderColor = 'var(--border-strong)')}
        />
        <p className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>Must start with /</p>
      </div>

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
          type="submit" disabled={isPending}
          className="px-3 py-1.5 rounded-md text-xs font-medium disabled:opacity-60"
          style={{ background: 'var(--accent)', color: '#0F1117' }}
        >
          {isPending ? (isEdit ? 'Saving…' : 'Creating…') : (isEdit ? 'Save' : 'Create path')}
        </button>
      </div>
    </form>
  )
}

// ─── Tree Node ────────────────────────────────────────────────────────────────

type NodeAction =
  | { type: 'addChild'; parentId: string }
  | { type: 'edit'; node: PathNode }
  | { type: 'delete'; node: PathNode }

function TreeNode({
  node,
  depth,
  projectId,
  onAction,
}: {
  node: PathNode
  depth: number
  projectId: string
  onAction: (a: NodeAction) => void
}) {
  const [expanded, setExpanded] = useState(true)
  const [menuOpen, setMenuOpen] = useState(false)
  const hasChildren = node.children.length > 0

  return (
    <div>
      <div
        className="group flex items-center gap-1 py-1 px-2 rounded-md cursor-default select-none"
        style={{ paddingLeft: `${8 + depth * 20}px` }}
        onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)')}
        onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = 'transparent')}
      >
        {/* Expand toggle */}
        <button
          onClick={() => setExpanded(v => !v)}
          className="flex items-center justify-center rounded"
          style={{ width: 16, height: 16, color: 'var(--text-muted)', visibility: hasChildren ? 'visible' : 'hidden' }}
        >
          {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        </button>

        {/* Icon */}
        <span style={{ color: 'var(--accent)', marginRight: 4 }}>
          {hasChildren
            ? (expanded ? <FolderOpen size={14} /> : <Folder size={14} />)
            : <GitBranch size={14} />}
        </span>

        {/* Name */}
        <span className="text-xs font-medium flex-1" style={{ color: 'var(--text-primary)' }}>
          {node.name}
        </span>

        {/* Path */}
        <span className="text-xs font-mono mr-2" style={{ color: 'var(--text-muted)' }}>
          {node.path}
        </span>

        {/* Resource count */}
        <span className="text-xs mr-1" style={{ color: 'var(--text-muted)' }}>
          {node._count.resources} {node._count.resources === 1 ? 'resource' : 'resources'}
        </span>

        {/* Actions */}
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity relative">
          <button
            onClick={() => onAction({ type: 'addChild', parentId: node.id })}
            className="p-1 rounded"
            style={{ color: 'var(--text-muted)' }}
            title="Add child path"
            onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = 'var(--accent)')}
            onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = 'var(--text-muted)')}
          >
            <Plus size={12} />
          </button>
          <button
            onClick={() => setMenuOpen(v => !v)}
            className="p-1 rounded"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = 'var(--text-primary)')}
            onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = 'var(--text-muted)')}
          >
            <MoreHorizontal size={12} />
          </button>

          {menuOpen && (
            <div
              className="absolute right-0 top-6 z-20 rounded-lg py-1 shadow-xl"
              style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-strong)', minWidth: 130 }}
              onMouseLeave={() => setMenuOpen(false)}
            >
              <button
                onClick={() => { setMenuOpen(false); onAction({ type: 'edit', node }) }}
                className="flex items-center gap-2 w-full px-3 py-2 text-xs text-left"
                style={{ color: 'var(--text-secondary)' }}
                onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)')}
                onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = 'transparent')}
              >
                <Pencil size={11} /> Edit
              </button>
              <button
                onClick={() => { setMenuOpen(false); onAction({ type: 'delete', node }) }}
                className="flex items-center gap-2 w-full px-3 py-2 text-xs text-left"
                style={{ color: 'var(--error)' }}
                onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)')}
                onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = 'transparent')}
              >
                <Trash2 size={11} /> Delete
              </button>
            </div>
          )}
        </div>
      </div>

      {expanded && hasChildren && (
        <div>
          {node.children.map(child => (
            <TreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              projectId={projectId}
              onAction={onAction}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type ModalState =
  | { mode: 'create'; parentId: null }
  | { mode: 'createChild'; parentId: string }
  | { mode: 'edit'; node: PathNode }
  | null

export function PathsPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const { data: paths, isLoading } = usePaths(projectId!)
  const del = useDeletePath(projectId!)
  const [modal, setModal] = useState<ModalState>(null)

  const tree = paths ? buildTree(paths) : []

  const handleAction = (a: NodeAction) => {
    if (a.type === 'addChild') setModal({ mode: 'createChild', parentId: a.parentId })
    if (a.type === 'edit') setModal({ mode: 'edit', node: a.node })
    if (a.type === 'delete') {
      if (!confirm(`Delete path "${a.node.name}"? This will also delete all child paths and resources.`)) return
      del.mutate(a.node.id)
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <h1 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Paths</h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
            Organize your mock endpoints into a path hierarchy.
          </p>
        </div>
        <button
          onClick={() => setModal({ mode: 'create', parentId: null })}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium"
          style={{ background: 'var(--accent)', color: '#0F1117' }}
        >
          <Plus size={13} /> New path
        </button>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Loading…</div>
      )}

      {/* Empty state */}
      {!isLoading && tree.length === 0 && (
        <div
          className="flex flex-col items-center justify-center rounded-lg py-16 text-center"
          style={{ border: '1px dashed var(--border-strong)' }}
        >
          <div
            className="flex items-center justify-center rounded-lg mb-4"
            style={{ width: 44, height: 44, background: 'var(--bg-elevated)', border: '1px solid var(--border-strong)' }}
          >
            <GitBranch size={20} style={{ color: 'var(--accent)' }} />
          </div>
          <p className="text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>No paths yet</p>
          <p className="text-xs mb-4" style={{ color: 'var(--text-secondary)' }}>
            Create your first path to start defining mock resources.
          </p>
          <button
            onClick={() => setModal({ mode: 'create', parentId: null })}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium"
            style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-strong)', color: 'var(--text-primary)' }}
          >
            <Plus size={13} /> New path
          </button>
        </div>
      )}

      {/* Tree */}
      {tree.length > 0 && (
        <div
          className="rounded-lg py-2"
          style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}
        >
          {tree.map(node => (
            <TreeNode
              key={node.id}
              node={node}
              depth={0}
              projectId={projectId!}
              onAction={handleAction}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      {modal?.mode === 'create' && (
        <Modal title="New path" onClose={() => setModal(null)}>
          <PathForm projectId={projectId!} parentId={null} onClose={() => setModal(null)} />
        </Modal>
      )}
      {modal?.mode === 'createChild' && (
        <Modal title="New child path" onClose={() => setModal(null)}>
          <PathForm projectId={projectId!} parentId={modal.parentId} onClose={() => setModal(null)} />
        </Modal>
      )}
      {modal?.mode === 'edit' && (
        <Modal title="Edit path" onClose={() => setModal(null)}>
          <PathForm
            projectId={projectId!}
            onClose={() => setModal(null)}
            initial={{ id: modal.node.id, name: modal.node.name, path: modal.node.path }}
          />
        </Modal>
      )}
    </div>
  )
}
