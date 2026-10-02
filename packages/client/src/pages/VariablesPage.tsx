import React, { useState } from 'react'
import { useParams } from 'react-router-dom'
import { Plus, Trash2, Pencil, Variable as VarIcon, Zap } from 'lucide-react'
import { useVariables, useCreateVariable, useUpdateVariable, useDeleteVariable } from '@/hooks/useVariables'
import { Modal } from '@/components/Modal'
import type { Variable } from '@/hooks/useVariables'

// ─── Constants ────────────────────────────────────────────────────────────────

const TYPE_META: Record<Variable['type'], { label: string; icon: React.ReactNode; color: string; hint: string }> = {
  STATIC:  { label: 'Static',  icon: <VarIcon size={12} />, color: '#3ECFCF', hint: 'Fixed value — never changes at runtime' },
  DYNAMIC: { label: 'Dynamic', icon: <Zap size={12} />,     color: '#F6AD55', hint: 'Extracted from the incoming request (body, header, query, path param)' },
}

const DYNAMIC_EXAMPLES = [
  'request.body.userId',
  'request.headers["x-tenant"]',
  'request.query.page',
  'request.params.id',
]

// ─── Variable Form ────────────────────────────────────────────────────────────

type VariableFormProps = {
  projectId: string
  onClose: () => void
  initial?: Variable
}

function VariableForm({ projectId, onClose, initial }: VariableFormProps) {
  const [name, setName] = useState(initial?.name ?? '')
  const [type, setType] = useState<Variable['type']>(initial?.type ?? 'STATIC')
  const [value, setValue] = useState(initial?.value ?? '')
  const [expression, setExpression] = useState(initial?.expression ?? '')
  const [error, setError] = useState('')
  const create = useCreateVariable(projectId)
  const update = useUpdateVariable(projectId)
  const isEdit = !!initial

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!name.match(/^[a-zA-Z_][a-zA-Z0-9_]*$/)) {
      setError('Name must start with a letter or underscore, and contain only letters, numbers or underscores')
      return
    }
    if (type === 'STATIC' && !value.trim()) {
      setError('Value is required for Static variables')
      return
    }
    if (type === 'DYNAMIC' && !expression.trim()) {
      setError('Expression is required for Dynamic variables')
      return
    }
    try {
      const payload = {
        name,
        type,
        value: type === 'STATIC' ? value : null,
        expression: type !== 'STATIC' ? expression : null,
      }
      if (isEdit) {
        await update.mutateAsync({ variableId: initial.id, ...payload })
      } else {
        await create.mutateAsync(payload)
      }
      onClose()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      setError(msg || `Failed to ${isEdit ? 'update' : 'create'} variable`)
    }
  }

  const isPending = create.isPending || update.isPending
  const meta = TYPE_META[type]

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {/* Name */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Name</label>
        <div className="flex items-center rounded-md overflow-hidden" style={{ border: '1px solid var(--border-strong)', background: 'var(--bg-surface)' }}>
          <span className="px-3 py-2 text-sm font-mono" style={{ color: 'var(--text-muted)', borderRight: '1px solid var(--border-strong)' }}>{'{{'}</span>
          <input
            autoFocus
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="baseUrl"
            className="flex-1 px-3 py-2 text-sm font-mono outline-none bg-transparent"
            style={{ color: 'var(--text-primary)' }}
          />
          <span className="px-3 py-2 text-sm font-mono" style={{ color: 'var(--text-muted)', borderLeft: '1px solid var(--border-strong)' }}>{'}}'}</span>
        </div>
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          Use <code style={{ color: 'var(--accent)' }}>{'{{' + (name || 'name') + '}}'}</code> in any response body to reference this variable.
        </p>
      </div>

      {/* Type selector */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Type</label>
        <div className="flex gap-2">
          {(Object.entries(TYPE_META) as [Variable['type'], typeof TYPE_META[keyof typeof TYPE_META]][]).map(([key, m]) => (
            <button
              key={key} type="button"
              onClick={() => setType(key)}
              className="flex items-center gap-1.5 flex-1 px-3 py-2 rounded-md text-xs font-medium text-left"
              style={{
                background: type === key ? m.color + '18' : 'var(--bg-surface)',
                border: `1px solid ${type === key ? m.color : 'var(--border-strong)'}`,
                color: type === key ? m.color : 'var(--text-muted)',
              }}
            >
              {m.icon} {m.label}
            </button>
          ))}
        </div>
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{meta.hint}</p>
      </div>

      {/* Value (STATIC) */}
      {type === 'STATIC' && (
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Value</label>
          <input
            value={value}
            onChange={e => setValue(e.target.value)}
            placeholder="https://api.example.com"
            className="rounded-md px-3 py-2 text-sm outline-none"
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', color: 'var(--text-primary)' }}
            onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
            onBlur={e => (e.target.style.borderColor = 'var(--border-strong)')}
          />
        </div>
      )}

      {/* Expression (DYNAMIC) */}
      {type !== 'STATIC' && (
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Expression</label>
          <input
            value={expression}
            onChange={e => setExpression(e.target.value)}
            placeholder={DYNAMIC_EXAMPLES[0]}
            className="rounded-md px-3 py-2 text-sm font-mono outline-none"
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', color: meta.color }}
            onFocus={e => (e.target.style.borderColor = meta.color)}
            onBlur={e => (e.target.style.borderColor = 'var(--border-strong)')}
          />
          <div className="flex flex-wrap gap-1.5 mt-0.5">
            {DYNAMIC_EXAMPLES.map(ex => (
              <button
                key={ex} type="button"
                onClick={() => setExpression(ex)}
                className="text-xs font-mono px-2 py-0.5 rounded"
                style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)', border: '1px solid var(--border-strong)' }}
              >
                {ex}
              </button>
            ))}
          </div>
        </div>
      )}

      {error && (
        <p className="text-xs px-3 py-2 rounded-md" style={{ background: 'rgba(245,101,101,0.1)', color: 'var(--error)' }}>
          {error}
        </p>
      )}

      <div className="flex justify-end gap-2 pt-1">
        <button type="button" onClick={onClose}
          className="px-3 py-1.5 rounded-md text-xs font-medium"
          style={{ background: 'var(--bg-hover)', color: 'var(--text-secondary)', border: '1px solid var(--border-strong)' }}
        >
          Cancel
        </button>
        <button type="submit" disabled={isPending}
          className="px-3 py-1.5 rounded-md text-xs font-medium disabled:opacity-60"
          style={{ background: 'var(--accent)', color: '#0F1117' }}
        >
          {isPending ? 'Saving…' : isEdit ? 'Save' : 'Create'}
        </button>
      </div>
    </form>
  )
}

// ─── Variable Row ─────────────────────────────────────────────────────────────

function VariableRow({
  variable, projectId, onEdit,
}: {
  variable: Variable
  projectId: string
  onEdit: (v: Variable) => void
}) {
  const del = useDeleteVariable(projectId)
  const meta = TYPE_META[variable.type]

  return (
    <tr className="group" style={{ borderBottom: '1px solid var(--border)' }}>
      {/* Name */}
      <td className="px-4 py-3">
        <span className="text-sm font-mono font-medium" style={{ color: 'var(--accent)' }}>
          {`{{${variable.name}}}`}
        </span>
      </td>

      {/* Type */}
      <td className="px-4 py-3">
        <span
          className="flex items-center gap-1.5 text-xs font-medium w-fit px-2 py-0.5 rounded-full"
          style={{ background: meta.color + '18', color: meta.color }}
        >
          {meta.icon} {meta.label}
        </span>
      </td>

      {/* Value / Expression */}
      <td className="px-4 py-3 max-w-xs">
        <span className="text-xs font-mono truncate block" style={{ color: 'var(--text-secondary)' }}>
          {variable.type === 'STATIC' ? variable.value : variable.expression}
        </span>
      </td>

      {/* Scope */}
      <td className="px-4 py-3">
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
          {variable.resourceId ? 'Resource' : 'Project'}
        </span>
      </td>

      {/* Actions */}
      <td className="px-4 py-3">
        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={() => onEdit(variable)} style={{ color: 'var(--text-muted)' }}
            onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = 'var(--text-primary)')}
            onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = 'var(--text-muted)')}
          >
            <Pencil size={13} />
          </button>
          <button
            onClick={() => { if (confirm(`Delete variable "{{${variable.name}}}"?`)) del.mutate(variable.id) }}
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = 'var(--error)')}
            onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = 'var(--text-muted)')}
          >
            <Trash2 size={13} />
          </button>
        </div>
      </td>
    </tr>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function VariablesPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const { data: variables, isLoading } = useVariables(projectId!)
  const [modal, setModal] = useState<null | { mode: 'create' } | { mode: 'edit'; variable: Variable }>(null)

  const projectVars = variables?.filter(v => !v.resourceId) ?? []
  const resourceVars = variables?.filter(v => !!v.resourceId) ?? []

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <h1 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Variables</h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
            Use <code style={{ color: 'var(--accent)' }}>{'{{variableName}}'}</code> in any response body to inject values at runtime.
          </p>
        </div>
        <button
          onClick={() => setModal({ mode: 'create' })}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium"
          style={{ background: 'var(--accent)', color: '#0F1117' }}
        >
          <Plus size={13} /> New variable
        </button>
      </div>

      {isLoading && <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Loading…</p>}

      {/* Empty state */}
      {!isLoading && !variables?.length && (
        <div
          className="flex flex-col items-center justify-center rounded-lg py-16 text-center"
          style={{ border: '1px dashed var(--border-strong)' }}
        >
          <div
            className="flex items-center justify-center rounded-lg mb-4"
            style={{ width: 44, height: 44, background: 'var(--bg-elevated)', border: '1px solid var(--border-strong)' }}
          >
            <VarIcon size={20} style={{ color: 'var(--accent)' }} />
          </div>
          <p className="text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>No variables yet</p>
          <p className="text-xs mb-4" style={{ color: 'var(--text-secondary)' }}>
            Create variables to inject dynamic values into your mock responses.
          </p>
          <button
            onClick={() => setModal({ mode: 'create' })}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium"
            style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-strong)', color: 'var(--text-primary)' }}
          >
            <Plus size={13} /> New variable
          </button>
        </div>
      )}

      {/* Tables */}
      {!!variables?.length && (
        <div className="flex flex-col gap-6">
          {/* Project-scoped */}
          <section>
            <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>
              Project variables
            </p>
            <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--border)' }}>
              <table className="w-full border-collapse">
                <thead>
                  <tr style={{ background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border)' }}>
                    {['Name', 'Type', 'Value / Expression', 'Scope', ''].map(h => (
                      <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {projectVars.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-6 text-xs text-center" style={{ color: 'var(--text-muted)' }}>
                        No project-level variables. Click "New variable" to add one.
                      </td>
                    </tr>
                  ) : projectVars.map(v => (
                    <VariableRow key={v.id} variable={v} projectId={projectId!} onEdit={v => setModal({ mode: 'edit', variable: v })} />
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Resource-scoped */}
          {resourceVars.length > 0 && (
            <section>
              <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>
                Resource variables
              </p>
              <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--border)' }}>
                <table className="w-full border-collapse">
                  <thead>
                    <tr style={{ background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border)' }}>
                      {['Name', 'Type', 'Value / Expression', 'Scope', ''].map(h => (
                        <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {resourceVars.map(v => (
                      <VariableRow key={v.id} variable={v} projectId={projectId!} onEdit={v => setModal({ mode: 'edit', variable: v })} />
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </div>
      )}

      {/* Modal */}
      {modal?.mode === 'create' && (
        <Modal title="New variable" onClose={() => setModal(null)} width={520}>
          <VariableForm projectId={projectId!} onClose={() => setModal(null)} />
        </Modal>
      )}
      {modal?.mode === 'edit' && (
        <Modal title="Edit variable" onClose={() => setModal(null)} width={520}>
          <VariableForm projectId={projectId!} onClose={() => setModal(null)} initial={modal.variable} />
        </Modal>
      )}
    </div>
  )
}
