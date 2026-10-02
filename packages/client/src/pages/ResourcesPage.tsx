import React, { useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  Plus, ChevronRight, ChevronDown, FolderOpen, Folder, GitBranch,
  Trash2, Pencil, ToggleLeft, ToggleRight, CheckCircle2,
  Circle, Zap, Shuffle, ListOrdered, GitMerge, Lock, Copy, Check, Variable as VarIcon,
} from 'lucide-react'
import { usePaths, buildTree } from '@/hooks/usePaths'
import { useProjects } from '@/hooks/useProjects'
import { useServerConfig } from '@/hooks/useServerConfig'
import { useResources, useCreateResource, useUpdateResource, useDeleteResource } from '@/hooks/useResources'
import { useResponses, useCreateResponse, useUpdateResponse, useDeleteResponse } from '@/hooks/useResponses'
import { useConditions, useCreateCondition, useUpdateCondition, useDeleteCondition } from '@/hooks/useConditions'
import { useVariables, useCreateVariable, useUpdateVariable, useDeleteVariable } from '@/hooks/useVariables'
import type { Variable } from '@/hooks/useVariables'
import { Modal } from '@/components/Modal'
import type { PathNode } from '@/types'
import type { Resource } from '@/hooks/useResources'
import type { MockResponse } from '@/hooks/useResponses'
import type { Condition } from '@/hooks/useConditions'

// ─── Constants ────────────────────────────────────────────────────────────────

const METHOD_COLORS: Record<string, string> = {
  GET:     '#3ECFCF',
  POST:    '#68D391',
  PUT:     '#F6AD55',
  PATCH:   '#B794F4',
  DELETE:  '#FC8181',
  HEAD:    '#76E4F7',
  OPTIONS: '#CBD5E0',
}

const STRATEGY_META: Record<Resource['strategy'], { label: string; icon: React.ReactNode; color: string }> = {
  FIXED:       { label: 'Fixed',       icon: <Lock size={10} />,        color: '#76E4F7' },
  SEQUENTIAL:  { label: 'Sequential',  icon: <ListOrdered size={10} />, color: '#B794F4' },
  RANDOM:      { label: 'Random',      icon: <Shuffle size={10} />,     color: '#F6AD55' },
  CONDITIONAL: { label: 'Conditional', icon: <GitMerge size={10} />,    color: '#68D391' },
}

function statusColor(code: number) {
  if (code < 300) return '#68D391'
  if (code < 400) return '#F6AD55'
  if (code < 500) return '#FC8181'
  return '#FC8181'
}

// ─── Resource Form ────────────────────────────────────────────────────────────

const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'] as const

type ResourceFormProps = {
  projectId: string
  pathId: string
  onClose: () => void
  initial?: Resource
}

function ResourceForm({ projectId, pathId, onClose, initial }: ResourceFormProps) {
  const [method, setMethod] = useState(initial?.method ?? 'GET')
  const [customPath, setCustomPath] = useState(initial?.customPath ?? '')
  const [isActive, setIsActive] = useState(initial?.isActive ?? true)
  const [strategy, setStrategy] = useState<Resource['strategy']>(initial?.strategy ?? 'FIXED')
  const [delay, setDelay] = useState(initial?.delay?.toString() ?? '')
  const [errorRate, setErrorRate] = useState(((initial?.errorRate ?? 0) * 100).toString())
  const [error, setError] = useState('')
  const create = useCreateResource(projectId, pathId)
  const update = useUpdateResource(projectId, pathId)
  const isEdit = !!initial

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    try {
      const payload = {
        method: method as Resource['method'],
        customPath: customPath.trim() || null,
        isActive,
        strategy,
        delay: delay ? parseInt(delay) : null,
        errorRate: parseFloat(errorRate) / 100 || 0,
      }
      if (isEdit) {
        await update.mutateAsync({ resourceId: initial.id, ...payload })
      } else {
        await create.mutateAsync(payload)
      }
      onClose()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      setError(msg || `Failed to ${isEdit ? 'update' : 'create'} resource`)
    }
  }

  const isPending = create.isPending || update.isPending

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {/* Method */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Method</label>
        <div className="flex flex-wrap gap-1.5">
          {METHODS.map(m => (
            <button
              key={m} type="button"
              onClick={() => setMethod(m)}
              className="px-2 py-1 rounded text-xs font-mono font-bold transition-opacity"
              style={{
                background: method === m ? METHOD_COLORS[m] + '22' : 'var(--bg-surface)',
                color: METHOD_COLORS[m],
                border: `1px solid ${method === m ? METHOD_COLORS[m] : 'var(--border-strong)'}`,
                opacity: method === m ? 1 : 0.6,
              }}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {/* Custom path override */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
          Custom path <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optional — overrides parent path)</span>
        </label>
        <input
          value={customPath}
          onChange={e => setCustomPath(e.target.value)}
          placeholder="/users/:id/posts"
          className="rounded-md px-3 py-2 text-sm font-mono outline-none"
          style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', color: 'var(--accent)' }}
          onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
          onBlur={e => (e.target.style.borderColor = 'var(--border-strong)')}
        />
      </div>

      {/* Strategy */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Response strategy</label>
        <div className="grid grid-cols-2 gap-1.5">
          {(Object.entries(STRATEGY_META) as [Resource['strategy'], typeof STRATEGY_META[keyof typeof STRATEGY_META]][]).map(([key, meta]) => (
            <button
              key={key} type="button"
              onClick={() => setStrategy(key)}
              className="flex items-center gap-2 px-3 py-2 rounded-md text-xs text-left transition-all"
              style={{
                background: strategy === key ? meta.color + '18' : 'var(--bg-surface)',
                border: `1px solid ${strategy === key ? meta.color : 'var(--border-strong)'}`,
                color: strategy === key ? meta.color : 'var(--text-muted)',
              }}
            >
              {meta.icon}
              <span className="font-medium">{meta.label}</span>
            </button>
          ))}
        </div>
        {strategy === 'CONDITIONAL' && (
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Configure conditions after creating the resource.
          </p>
        )}
      </div>

      {/* Delay + Error rate */}
      <div className="flex gap-3">
        <div className="flex flex-col gap-1.5 flex-1">
          <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Fixed delay (ms)</label>
          <input
            type="number" min="0" value={delay}
            onChange={e => setDelay(e.target.value)}
            placeholder="0"
            className="rounded-md px-3 py-2 text-sm outline-none"
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', color: 'var(--text-primary)' }}
            onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
            onBlur={e => (e.target.style.borderColor = 'var(--border-strong)')}
          />
        </div>
        <div className="flex flex-col gap-1.5 flex-1">
          <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Error rate (%)</label>
          <input
            type="number" min="0" max="100" value={errorRate}
            onChange={e => setErrorRate(e.target.value)}
            placeholder="0"
            className="rounded-md px-3 py-2 text-sm outline-none"
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', color: 'var(--text-primary)' }}
            onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
            onBlur={e => (e.target.style.borderColor = 'var(--border-strong)')}
          />
        </div>
      </div>

      {/* Active toggle */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Active</span>
        <button
          type="button" onClick={() => setIsActive(v => !v)}
          style={{ color: isActive ? 'var(--accent)' : 'var(--text-muted)' }}
        >
          {isActive ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
        </button>
      </div>

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

// ─── Response Form ────────────────────────────────────────────────────────────

type ResponseFormProps = {
  projectId: string
  pathId: string
  resourceId: string
  onClose: () => void
  initial?: MockResponse
}

function ResponseForm({ projectId, pathId, resourceId, onClose, initial }: ResponseFormProps) {
  const [name, setName] = useState(initial?.name ?? '')
  const [statusCode, setStatusCode] = useState(initial?.statusCode?.toString() ?? '200')
  const [bodyType, setBodyType] = useState<'JSON' | 'XML' | 'TEXT'>(initial?.bodyType ?? 'JSON')
  const [body, setBody] = useState(initial?.body ?? '')
  const [isDefault, setIsDefault] = useState(initial?.isDefault ?? false)
  const [headers, setHeaders] = useState<{ key: string; value: string }[]>(
    initial?.headers?.map(h => ({ key: h.key, value: h.value })) ?? []
  )
  const [error, setError] = useState('')
  const create = useCreateResponse(projectId, pathId, resourceId)
  const update = useUpdateResponse(projectId, pathId, resourceId)
  const isEdit = !!initial

  const addHeader = () => setHeaders(h => [...h, { key: '', value: '' }])
  const removeHeader = (i: number) => setHeaders(h => h.filter((_, idx) => idx !== i))
  const updateHeader = (i: number, field: 'key' | 'value', val: string) =>
    setHeaders(h => h.map((hdr, idx) => idx === i ? { ...hdr, [field]: val } : hdr))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    const code = parseInt(statusCode)
    if (isNaN(code) || code < 100 || code > 599) { setError('Status code must be 100–599'); return }
    try {
      const payload = {
        name: name.trim() || null,
        statusCode: code,
        bodyType,
        body: body.trim() || null,
        isDefault,
        headers: headers.filter(h => h.key.trim()),
      }
      if (isEdit) {
        await update.mutateAsync({ responseId: initial.id, ...payload })
      } else {
        await create.mutateAsync(payload)
      }
      onClose()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      setError(msg || `Failed to ${isEdit ? 'update' : 'create'} response`)
    }
  }

  const isPending = create.isPending || update.isPending

  const bodyPlaceholders: Record<string, string> = {
    JSON: '{\n  "id": 1,\n  "name": "example"\n}',
    XML:  '<root>\n  <id>1</id>\n</root>',
    TEXT: 'OK',
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {/* Name */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
          Name <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span>
        </label>
        <input
          autoFocus value={name} onChange={e => setName(e.target.value)}
          placeholder="Success response"
          className="rounded-md px-3 py-2 text-sm outline-none"
          style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', color: 'var(--text-primary)' }}
          onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
          onBlur={e => (e.target.style.borderColor = 'var(--border-strong)')}
        />
      </div>

      {/* Status + Body type */}
      <div className="flex gap-3">
        <div className="flex flex-col gap-1.5" style={{ width: 100 }}>
          <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Status</label>
          <input
            type="number" min="100" max="599" value={statusCode}
            onChange={e => setStatusCode(e.target.value)}
            className="rounded-md px-3 py-2 text-sm font-mono outline-none"
            style={{
              background: 'var(--bg-surface)', border: '1px solid var(--border-strong)',
              color: statusColor(parseInt(statusCode) || 200),
            }}
            onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
            onBlur={e => (e.target.style.borderColor = 'var(--border-strong)')}
          />
        </div>
        <div className="flex flex-col gap-1.5 flex-1">
          <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Body type</label>
          <div className="flex gap-1">
            {(['JSON', 'XML', 'TEXT'] as const).map(t => (
              <button key={t} type="button" onClick={() => setBodyType(t)}
                className="flex-1 py-2 rounded-md text-xs font-mono font-medium"
                style={{
                  background: bodyType === t ? 'var(--accent)' : 'var(--bg-surface)',
                  color: bodyType === t ? '#0F1117' : 'var(--text-muted)',
                  border: `1px solid ${bodyType === t ? 'var(--accent)' : 'var(--border-strong)'}`,
                }}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Body</label>
        <textarea
          value={body} onChange={e => setBody(e.target.value)}
          placeholder={bodyPlaceholders[bodyType]}
          rows={6}
          className="rounded-md px-3 py-2 text-xs font-mono outline-none resize-y"
          style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', color: 'var(--text-primary)' }}
          onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
          onBlur={e => (e.target.style.borderColor = 'var(--border-strong)')}
        />
      </div>

      {/* Headers */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Headers</label>
          <button type="button" onClick={addHeader}
            className="text-xs flex items-center gap-1"
            style={{ color: 'var(--accent)' }}
          >
            <Plus size={11} /> Add
          </button>
        </div>
        {headers.map((h, i) => (
          <div key={i} className="flex gap-2 items-center">
            <input
              value={h.key} onChange={e => updateHeader(i, 'key', e.target.value)}
              placeholder="Content-Type"
              className="rounded-md px-2 py-1.5 text-xs font-mono outline-none flex-1"
              style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', color: 'var(--text-primary)' }}
            />
            <input
              value={h.value} onChange={e => updateHeader(i, 'value', e.target.value)}
              placeholder="application/json"
              className="rounded-md px-2 py-1.5 text-xs font-mono outline-none flex-1"
              style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', color: 'var(--text-primary)' }}
            />
            <button type="button" onClick={() => removeHeader(i)} style={{ color: 'var(--error)' }}>
              <Trash2 size={12} />
            </button>
          </div>
        ))}
      </div>

      {/* Default toggle */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Set as default response</span>
        <button type="button" onClick={() => setIsDefault(v => !v)}
          style={{ color: isDefault ? 'var(--accent)' : 'var(--text-muted)' }}
        >
          {isDefault ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
        </button>
      </div>

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

// ─── Response Row ─────────────────────────────────────────────────────────────

function ResponseRow({
  response, projectId, pathId, resourceId,
  onEdit,
}: {
  response: MockResponse
  projectId: string
  pathId: string
  resourceId: string
  onEdit: (r: MockResponse) => void
}) {
  const del = useDeleteResponse(projectId, pathId, resourceId)
  const update = useUpdateResponse(projectId, pathId, resourceId)

  return (
    <div
      className="flex items-center gap-2 py-1.5 px-3 rounded-md group"
      style={{ background: 'var(--bg-hover)' }}
    >
      {/* Default indicator */}
      <button
        onClick={() => update.mutate({ responseId: response.id, isDefault: !response.isDefault })}
        title={response.isDefault ? 'Default' : 'Set as default'}
        style={{ color: response.isDefault ? 'var(--accent)' : 'var(--text-muted)', flexShrink: 0 }}
      >
        {response.isDefault ? <CheckCircle2 size={13} /> : <Circle size={13} />}
      </button>

      {/* Status code */}
      <span className="text-xs font-mono font-bold" style={{ color: statusColor(response.statusCode), minWidth: 32 }}>
        {response.statusCode}
      </span>

      {/* Name */}
      <span className="text-xs flex-1 truncate" style={{ color: 'var(--text-primary)' }}>
        {response.name || <span style={{ color: 'var(--text-muted)' }}>Unnamed</span>}
      </span>

      {/* Body type */}
      <span className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>{response.bodyType}</span>

      {/* Actions */}
      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={() => onEdit(response)} style={{ color: 'var(--text-muted)' }}
          onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = 'var(--text-primary)')}
          onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = 'var(--text-muted)')}
        >
          <Pencil size={11} />
        </button>
        <button
          onClick={() => { if (confirm('Delete this response?')) del.mutate(response.id) }}
          style={{ color: 'var(--text-muted)' }}
          onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = 'var(--error)')}
          onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = 'var(--text-muted)')}
        >
          <Trash2 size={11} />
        </button>
      </div>
    </div>
  )
}

// ─── Resource Row ─────────────────────────────────────────────────────────────

type ResourceRowProps = {
  resource: Resource
  projectId: string
  pathId: string
  projectSlug: string
  pathPath: string
  mockBaseUrl: string
  onEdit: (r: Resource) => void
}

type ExpandedTab = 'responses' | 'conditions' | 'variables'

function ConditionsPanel({
  projectId, pathId, resource, responses,
}: {
  projectId: string
  pathId: string
  resource: Resource
  responses: MockResponse[] | undefined
}) {
  const { data: conditions } = useConditions(projectId, pathId, resource.id)
  const create = useCreateCondition(projectId, pathId, resource.id)
  const update = useUpdateCondition(projectId, pathId, resource.id)
  const del = useDeleteCondition(projectId, pathId, resource.id)
  const [editId, setEditId] = useState<string | null>(null)
  const [newExpr, setNewExpr] = useState('')
  const [newResponseId, setNewResponseId] = useState('')
  const [adding, setAdding] = useState(false)

  const handleAdd = async () => {
    if (!newExpr.trim() || !newResponseId) return
    await create.mutateAsync({ expression: newExpr.trim(), responseId: newResponseId })
    setNewExpr('')
    setNewResponseId('')
    setAdding(false)
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
          Conditions <span style={{ fontWeight: 400 }}>(evaluated top→bottom)</span>
        </span>
        <button onClick={() => setAdding(v => !v)} className="flex items-center gap-1 text-xs" style={{ color: 'var(--accent)' }}>
          <Plus size={11} /> Add condition
        </button>
      </div>

      {adding && (
        <div className="flex flex-col gap-2 p-2 rounded-md" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-strong)' }}>
          <input
            autoFocus
            value={newExpr}
            onChange={e => setNewExpr(e.target.value)}
            placeholder='request.body.status == "active"'
            className="rounded px-2 py-1.5 text-xs font-mono outline-none w-full"
            style={{ background: 'var(--bg-hover)', border: '1px solid var(--border-strong)', color: 'var(--text-primary)' }}
            onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
            onBlur={e => (e.target.style.borderColor = 'var(--border-strong)')}
            onKeyDown={e => { if (e.key === 'Enter' && newExpr.trim() && newResponseId) handleAdd() }}
          />
          {/* Syntax reference */}
          <div className="rounded p-2 text-xs" style={{ background: 'var(--bg-base)', border: '1px solid var(--border)' }}>
            <p className="font-semibold mb-1.5" style={{ color: 'var(--text-muted)' }}>Syntax reference</p>
            <div className="flex flex-col gap-1">
              {[
                ['Sources',  'request.body.field  ·  request.query.key  ·  request.params.id  ·  request.headers["x-key"]'],
                ['Operators','==  !=  >  <  >=  <=  contains'],
                ['Unary',    'request.body.field exists   /   request.body.field !exists'],
              ].map(([label, val]) => (
                <div key={label} className="flex gap-2">
                  <span style={{ color: 'var(--text-muted)', minWidth: 60, flexShrink: 0 }}>{label}</span>
                  <span className="font-mono" style={{ color: 'var(--text-secondary)' }}>{val}</span>
                </div>
              ))}
            </div>
            <p className="mt-1.5 font-semibold" style={{ color: 'var(--text-muted)' }}>Examples</p>
            <div className="flex flex-col gap-0.5 mt-0.5">
              {[
                'request.body.role == "admin"',
                'request.query.page > 1',
                'request.params.id == "123"',
                'request.headers["x-api-key"] exists',
                'request.body.name contains "test"',
              ].map(ex => (
                <button
                  key={ex}
                  className="text-left font-mono hover:underline"
                  style={{ color: 'var(--accent)', opacity: 0.85 }}
                  onClick={() => setNewExpr(ex)}
                >
                  {ex}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <select
              value={newResponseId}
              onChange={e => setNewResponseId(e.target.value)}
              className="flex-1 rounded px-2 py-1.5 text-xs outline-none"
              style={{ background: 'var(--bg-hover)', border: '1px solid var(--border-strong)', color: 'var(--text-primary)' }}
            >
              <option value="">— select response —</option>
              {responses?.map(r => (
                <option key={r.id} value={r.id}>
                  {r.statusCode} {r.name || 'Unnamed'}
                </option>
              ))}
            </select>
            <button
              onClick={handleAdd}
              disabled={!newExpr.trim() || !newResponseId || create.isPending}
              className="px-3 py-1 rounded text-xs font-medium disabled:opacity-50"
              style={{ background: 'var(--accent)', color: '#0F1117' }}
            >
              Add
            </button>
            <button onClick={() => setAdding(false)} className="px-2 py-1 rounded text-xs" style={{ color: 'var(--text-muted)' }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {!conditions && <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Loading…</span>}
      {conditions?.length === 0 && !adding && (
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>No conditions. Add one to route requests to specific responses.</span>
      )}

      {conditions?.map((c, i) => {
        const resp = responses?.find(r => r.id === c.responseId)
        const isEditing = editId === c.id
        return (
          <div key={c.id} className="flex items-center gap-2 px-2 py-1.5 rounded group" style={{ background: 'var(--bg-surface)' }}>
            <span className="text-xs font-mono" style={{ color: 'var(--text-muted)', minWidth: 16 }}>{i + 1}.</span>
            {isEditing ? (
              <input
                autoFocus
                defaultValue={c.expression}
                className="flex-1 rounded px-2 py-1 text-xs font-mono outline-none"
                style={{ background: 'var(--bg-hover)', border: '1px solid var(--accent)', color: 'var(--text-primary)' }}
                onBlur={e => { update.mutate({ conditionId: c.id, expression: e.target.value }); setEditId(null) }}
                onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
              />
            ) : (
              <span className="flex-1 text-xs font-mono truncate" style={{ color: 'var(--text-primary)' }}>{c.expression}</span>
            )}
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>→</span>
            <span className="text-xs font-mono" style={{ color: resp ? '#68D391' : 'var(--error)' }}>
              {resp ? `${resp.statusCode} ${resp.name || ''}` : 'missing'}
            </span>
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button onClick={() => setEditId(isEditing ? null : c.id)} style={{ color: 'var(--text-muted)' }}>
                <Pencil size={11} />
              </button>
              <button onClick={() => del.mutate(c.id)} style={{ color: 'var(--text-muted)' }}
                onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = 'var(--error)')}
                onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = 'var(--text-muted)')}
              >
                <Trash2 size={11} />
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function CopyEndpointButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation()
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }
  return (
    <button
      onClick={handleCopy}
      title={copied ? 'Copied!' : `Copy: ${url}`}
      className="flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-mono transition-all"
      style={{
        color: copied ? '#68D391' : 'var(--text-muted)',
        background: copied ? '#68D39118' : 'transparent',
        border: `1px solid ${copied ? '#68D39140' : 'transparent'}`,
      }}
      onMouseEnter={e => { if (!copied) (e.currentTarget as HTMLElement).style.color = 'var(--accent)' }}
      onMouseLeave={e => { if (!copied) (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)' }}
    >
      {copied ? <Check size={11} /> : <Copy size={11} />}
    </button>
  )
}

// ─── Variable type metadata (inline) ─────────────────────────────────────────

const VAR_TYPE_META = {
  STATIC:  { label: 'Static',  icon: <VarIcon size={10} />, color: '#3ECFCF' },
  DYNAMIC: { label: 'Dynamic', icon: <Zap size={10} />,     color: '#F6AD55' },
} as const

// ─── Variables Panel ──────────────────────────────────────────────────────────

function VariablesPanel({
  projectId, resource,
}: {
  projectId: string
  resource: Resource
}) {
  const { data: variables } = useVariables(projectId)
  const create = useCreateVariable(projectId)
  const update = useUpdateVariable(projectId)
  const del = useDeleteVariable(projectId)

  const [adding, setAdding] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)

  // Only resource-scoped variables for this resource
  const vars = variables?.filter(v => v.resourceId === resource.id) ?? []

  // Form state for new variable
  const [newName, setNewName] = useState('')
  const [newType, setNewType] = useState<Variable['type']>('STATIC')
  const [newValue, setNewValue] = useState('')
  const [newExpr, setNewExpr] = useState('')
  const [formError, setFormError] = useState('')

  const resetForm = () => { setNewName(''); setNewType('STATIC'); setNewValue(''); setNewExpr(''); setFormError(''); setAdding(false) }

  const handleAdd = async () => {
    setFormError('')
    if (!newName.match(/^[a-zA-Z_][a-zA-Z0-9_]*$/)) { setFormError('Invalid identifier'); return }
    if (newType === 'STATIC' && !newValue.trim()) { setFormError('Value required'); return }
    if (newType !== 'STATIC' && !newExpr.trim()) { setFormError('Expression required'); return }
    try {
      await create.mutateAsync({
        name: newName,
        type: newType,
        value: newType === 'STATIC' ? newValue : null,
        expression: newType !== 'STATIC' ? newExpr : null,
        resourceId: resource.id,
      })
      resetForm()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      setFormError(msg || 'Failed to create variable')
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
          Resource variables <span style={{ fontWeight: 400 }}>(override project variables with same name)</span>
        </span>
        <button onClick={() => setAdding(v => !v)} className="flex items-center gap-1 text-xs" style={{ color: 'var(--accent)' }}>
          <Plus size={11} /> Add variable
        </button>
      </div>

      {/* Add form */}
      {adding && (
        <div className="flex flex-col gap-2 p-3 rounded-md" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-strong)' }}>
          {/* Name */}
          <div className="flex items-center rounded overflow-hidden" style={{ border: '1px solid var(--border-strong)' }}>
            <span className="px-2 py-1.5 text-xs font-mono" style={{ color: 'var(--text-muted)', background: 'var(--bg-elevated)', borderRight: '1px solid var(--border-strong)' }}>{'{{'}</span>
            <input
              autoFocus value={newName} onChange={e => setNewName(e.target.value)}
              placeholder="variableName"
              className="flex-1 px-2 py-1.5 text-xs font-mono outline-none bg-transparent"
              style={{ color: 'var(--text-primary)' }}
            />
            <span className="px-2 py-1.5 text-xs font-mono" style={{ color: 'var(--text-muted)', background: 'var(--bg-elevated)', borderLeft: '1px solid var(--border-strong)' }}>{'}}'}</span>
          </div>

          {/* Type selector */}
          <div className="flex gap-1.5">
            {(Object.entries(VAR_TYPE_META) as [Variable['type'], typeof VAR_TYPE_META[keyof typeof VAR_TYPE_META]][]).map(([k, m]) => (
              <button key={k} type="button" onClick={() => setNewType(k)}
                className="flex items-center gap-1 flex-1 px-2 py-1 rounded text-xs"
                style={{
                  background: newType === k ? m.color + '18' : 'var(--bg-hover)',
                  border: `1px solid ${newType === k ? m.color : 'var(--border-strong)'}`,
                  color: newType === k ? m.color : 'var(--text-muted)',
                }}
              >
                {m.icon} {m.label}
              </button>
            ))}
          </div>

          {/* Value / Expression */}
          <input
            value={newType === 'STATIC' ? newValue : newExpr}
            onChange={e => newType === 'STATIC' ? setNewValue(e.target.value) : setNewExpr(e.target.value)}
            placeholder={newType === 'STATIC' ? 'value' : newType === 'DYNAMIC' ? 'request.body.field' : 'Date.now()'}
            className="rounded px-2 py-1.5 text-xs font-mono outline-none"
            style={{
              background: 'var(--bg-hover)', border: '1px solid var(--border-strong)',
              color: newType === 'STATIC' ? 'var(--text-primary)' : VAR_TYPE_META[newType].color,
            }}
            onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
            onBlur={e => (e.target.style.borderColor = 'var(--border-strong)')}
          />

          {formError && <p className="text-xs" style={{ color: 'var(--error)' }}>{formError}</p>}

          <div className="flex gap-2">
            <button onClick={handleAdd} disabled={create.isPending}
              className="px-3 py-1 rounded text-xs font-medium disabled:opacity-50"
              style={{ background: 'var(--accent)', color: '#0F1117' }}
            >
              {create.isPending ? 'Adding…' : 'Add'}
            </button>
            <button onClick={resetForm} className="px-2 py-1 rounded text-xs" style={{ color: 'var(--text-muted)' }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {vars.length === 0 && !adding && (
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
          No resource variables yet. Project variables still apply.
        </span>
      )}

      {vars.map(v => {
        const meta = VAR_TYPE_META[v.type]
        const isEditing = editId === v.id
        return (
          <div key={v.id} className="flex items-center gap-2 px-2 py-1.5 rounded group" style={{ background: 'var(--bg-surface)' }}>
            <span className="text-xs font-mono font-medium" style={{ color: 'var(--accent)', minWidth: 100 }}>
              {`{{${v.name}}}`}
            </span>
            <span className="flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full flex-shrink-0"
              style={{ background: meta.color + '18', color: meta.color }}>
              {meta.icon} {meta.label}
            </span>
            {isEditing ? (
              <input
                autoFocus
                defaultValue={v.type === 'STATIC' ? (v.value ?? '') : (v.expression ?? '')}
                className="flex-1 rounded px-2 py-1 text-xs font-mono outline-none"
                style={{ background: 'var(--bg-hover)', border: `1px solid ${meta.color}`, color: 'var(--text-primary)' }}
                onBlur={e => {
                  const val = e.target.value
                  update.mutate({
                    variableId: v.id,
                    value: v.type === 'STATIC' ? val : null,
                    expression: v.type !== 'STATIC' ? val : null,
                  })
                  setEditId(null)
                }}
                onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
              />
            ) : (
              <span className="flex-1 text-xs font-mono truncate" style={{ color: 'var(--text-secondary)' }}>
                {v.type === 'STATIC' ? v.value : v.expression}
              </span>
            )}
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button onClick={() => setEditId(isEditing ? null : v.id)} style={{ color: 'var(--text-muted)' }}>
                <Pencil size={11} />
              </button>
              <button onClick={() => del.mutate(v.id)} style={{ color: 'var(--text-muted)' }}
                onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = 'var(--error)')}
                onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = 'var(--text-muted)')}
              >
                <Trash2 size={11} />
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function ResourceRow({ resource, projectId, pathId, projectSlug, pathPath, mockBaseUrl, onEdit }: ResourceRowProps) {
  const [expanded, setExpanded] = useState(false)
  const [activeTab, setActiveTab] = useState<ExpandedTab>('responses')
  const [addResponse, setAddResponse] = useState(false)
  const [editResponse, setEditResponse] = useState<MockResponse | null>(null)
  const del = useDeleteResource(projectId, pathId)
  const update = useUpdateResource(projectId, pathId)
  const { data: responses } = useResponses(projectId, pathId, expanded ? resource.id : null)

  return (
    <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--border)' }}>
      {/* Resource header */}
      <div
        className="flex items-center gap-2 px-3 py-2.5 cursor-pointer group"
        style={{ background: 'var(--bg-surface)' }}
        onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)')}
        onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = 'var(--bg-surface)')}
        onClick={() => setExpanded(v => !v)}
      >
        {/* Expand */}
        <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>
          {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        </span>

        {/* Active dot */}
        <span
          className="rounded-full flex-shrink-0"
          style={{
            width: 6, height: 6,
            background: resource.isActive ? 'var(--accent)' : 'var(--text-muted)',
          }}
        />

        {/* Method badge */}
        <span
          className="text-xs font-mono font-bold px-1.5 py-0.5 rounded"
          style={{
            background: METHOD_COLORS[resource.method] + '22',
            color: METHOD_COLORS[resource.method],
            minWidth: 52, textAlign: 'center',
          }}
        >
          {resource.method}
        </span>

        {/* Effective path + copy button */}
        {(() => {
          const effectivePath = resource.customPath ?? pathPath
          const url = `${mockBaseUrl}/${projectSlug}${effectivePath}`
          return (
            <>
              <span className="text-xs font-mono" style={{ color: 'var(--accent)' }}>
                {effectivePath}
              </span>
              <CopyEndpointButton url={url} />
            </>
          )
        })()}

        {/* Strategy badge */}
        {(() => {
          const meta = STRATEGY_META[resource.strategy]
          return (
            <span
              className="flex items-center gap-1 text-xs px-1.5 py-0.5 rounded"
              style={{ background: meta.color + '18', color: meta.color }}
            >
              {meta.icon} {meta.label}
            </span>
          )
        })()}

        {/* Spacer */}
        <span className="flex-1" />

        {/* Response count */}
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
          {resource._count.responses} {resource._count.responses === 1 ? 'response' : 'responses'}
        </span>

        {/* Error rate */}
        {resource.errorRate > 0 && (
          <span className="text-xs font-mono" style={{ color: '#FC8181' }}>
            {(resource.errorRate * 100).toFixed(0)}% err
          </span>
        )}

        {/* Delay */}
        {resource.delay != null && resource.delay > 0 && (
          <span className="text-xs font-mono flex items-center gap-0.5" style={{ color: 'var(--text-muted)' }}>
            <Zap size={10} />{resource.delay}ms
          </span>
        )}

        {/* Actions */}
        <div
          className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={e => e.stopPropagation()}
        >
          <button
            onClick={() => update.mutate({ resourceId: resource.id, isActive: !resource.isActive })}
            title={resource.isActive ? 'Deactivate' : 'Activate'}
            style={{ color: resource.isActive ? 'var(--accent)' : 'var(--text-muted)' }}
          >
            {resource.isActive ? <ToggleRight size={15} /> : <ToggleLeft size={15} />}
          </button>
          <button onClick={() => onEdit(resource)} style={{ color: 'var(--text-muted)' }}
            onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = 'var(--text-primary)')}
            onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = 'var(--text-muted)')}
          >
            <Pencil size={13} />
          </button>
          <button
            onClick={() => { if (confirm('Delete this resource and all its responses?')) del.mutate(resource.id) }}
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = 'var(--error)')}
            onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = 'var(--text-muted)')}
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {/* Expanded panel */}
      {expanded && (
        <div style={{ borderTop: '1px solid var(--border)', background: 'var(--bg-elevated)' }}>
          {/* Tabs */}
          <div className="flex" style={{ borderBottom: '1px solid var(--border)' }}>
            {(['responses', 'conditions', 'variables'] as ExpandedTab[]).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className="px-4 py-2 text-xs font-medium capitalize"
                style={{
                  color: activeTab === tab ? 'var(--accent)' : 'var(--text-muted)',
                  borderBottom: activeTab === tab ? '2px solid var(--accent)' : '2px solid transparent',
                  marginBottom: -1,
                }}
              >
                {tab}
                {tab === 'conditions' && resource.strategy !== 'CONDITIONAL' && (
                  <span className="ml-1 text-xs" style={{ color: 'var(--text-muted)', opacity: 0.5 }}>(strategy: {resource.strategy})</span>
                )}
              </button>
            ))}
          </div>

          <div className="px-3 py-2.5 flex flex-col gap-1.5">
            {activeTab === 'responses' && (
              <>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Responses</span>
                  <button onClick={() => setAddResponse(true)} className="flex items-center gap-1 text-xs" style={{ color: 'var(--accent)' }}>
                    <Plus size={11} /> Add response
                  </button>
                </div>
                {!responses && <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Loading…</span>}
                {responses?.length === 0 && (
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>No responses yet. Add one to start mocking.</span>
                )}
                {responses?.map(r => (
                  <ResponseRow key={r.id} response={r} projectId={projectId} pathId={pathId} resourceId={resource.id} onEdit={setEditResponse} />
                ))}
              </>
            )}

            {activeTab === 'conditions' && (
              <ConditionsPanel projectId={projectId} pathId={pathId} resource={resource} responses={responses} />
            )}

            {activeTab === 'variables' && (
              <VariablesPanel projectId={projectId} resource={resource} />
            )}
          </div>
        </div>
      )}

      {/* Modals */}
      {addResponse && (
        <Modal title="New response" onClose={() => setAddResponse(false)} width={540}>
          <ResponseForm
            projectId={projectId}
            pathId={pathId}
            resourceId={resource.id}
            onClose={() => setAddResponse(false)}
          />
        </Modal>
      )}
      {editResponse && (
        <Modal title="Edit response" onClose={() => setEditResponse(null)} width={540}>
          <ResponseForm
            projectId={projectId}
            pathId={pathId}
            resourceId={resource.id}
            onClose={() => setEditResponse(null)}
            initial={editResponse}
          />
        </Modal>
      )}
    </div>
  )
}

// ─── Path Tree (selector, read-only) ─────────────────────────────────────────

function PathTreeNode({
  node, depth, selected, onSelect,
}: {
  node: PathNode
  depth: number
  selected: string | null
  onSelect: (id: string) => void
}) {
  const [expanded, setExpanded] = useState(true)
  const hasChildren = node.children.length > 0
  const isSelected = node.id === selected

  return (
    <div>
      <div
        className="flex items-center gap-1 py-1 px-2 rounded-md cursor-pointer"
        style={{
          paddingLeft: `${8 + depth * 16}px`,
          background: isSelected ? 'var(--accent)22' : 'transparent',
        }}
        onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)' }}
        onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
        onClick={() => onSelect(node.id)}
      >
        <button
          onClick={e => { e.stopPropagation(); setExpanded(v => !v) }}
          style={{ width: 14, color: 'var(--text-muted)', visibility: hasChildren ? 'visible' : 'hidden' }}
        >
          {expanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
        </button>
        <span style={{ color: isSelected ? 'var(--accent)' : 'var(--text-muted)', marginRight: 4 }}>
          {hasChildren
            ? (expanded ? <FolderOpen size={12} /> : <Folder size={12} />)
            : <GitBranch size={12} />}
        </span>
        <span className="text-xs truncate flex-1" style={{ color: isSelected ? 'var(--accent)' : 'var(--text-primary)' }}>
          {node.name}
        </span>
        <span className="text-xs font-mono ml-1" style={{ color: isSelected ? 'var(--accent)' : 'var(--text-muted)', opacity: 0.7 }}>
          {node._count.resources}
        </span>
      </div>
      {expanded && hasChildren && node.children.map(c => (
        <PathTreeNode key={c.id} node={c} depth={depth + 1} selected={selected} onSelect={onSelect} />
      ))}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type ResourceModal =
  | { mode: 'create' }
  | { mode: 'edit'; resource: Resource }
  | null

export function ResourcesPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const { data: projects } = useProjects()
  const { data: serverConfig } = useServerConfig()
  const { data: paths, isLoading: pathsLoading } = usePaths(projectId!)
  const [selectedPathId, setSelectedPathId] = useState<string | null>(null)
  const [resourceModal, setResourceModal] = useState<ResourceModal>(null)

  const tree = paths ? buildTree(paths) : []
  const { data: resources, isLoading: resLoading } = useResources(projectId!, selectedPathId)

  const selectedPath = paths?.find(p => p.id === selectedPathId)
  const projectSlug = projects?.find(p => p.id === projectId)?.slug ?? ''
  const mockBaseUrl = serverConfig?.mockBaseUrl ?? window.location.origin

  return (
    <div className="flex h-full gap-0" style={{ minHeight: 0 }}>
      {/* ── Left: Path tree ───────────────────────────────────── */}
      <div
        className="flex flex-col flex-shrink-0"
        style={{
          width: 220,
          borderRight: '1px solid var(--border)',
          paddingRight: 0,
        }}
      >
        <div className="px-2 py-3">
          <p className="text-xs font-semibold mb-2 px-2" style={{ color: 'var(--text-muted)' }}>PATHS</p>
          {pathsLoading && (
            <p className="text-xs px-2" style={{ color: 'var(--text-muted)' }}>Loading…</p>
          )}
          {!pathsLoading && tree.length === 0 && (
            <p className="text-xs px-2" style={{ color: 'var(--text-muted)' }}>
              No paths. Create one in the Paths section.
            </p>
          )}
          {tree.map(node => (
            <PathTreeNode
              key={node.id}
              node={node}
              depth={0}
              selected={selectedPathId}
              onSelect={setSelectedPathId}
            />
          ))}
        </div>
      </div>

      {/* ── Right: Resources panel ────────────────────────────── */}
      <div className="flex flex-col flex-1 min-w-0 pl-5">
        {!selectedPathId ? (
          <div className="flex flex-col items-center justify-center flex-1 text-center py-20">
            <GitBranch size={28} style={{ color: 'var(--text-muted)', marginBottom: 12 }} />
            <p className="text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>Select a path</p>
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              Pick a path on the left to see its resources.
            </p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                  {selectedPath?.name}
                </p>
                <p className="text-xs font-mono" style={{ color: 'var(--accent)' }}>
                  {selectedPath?.path}
                </p>
              </div>
              <button
                onClick={() => setResourceModal({ mode: 'create' })}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium"
                style={{ background: 'var(--accent)', color: '#0F1117' }}
              >
                <Plus size={13} /> New resource
              </button>
            </div>

            {/* Loading */}
            {resLoading && (
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Loading…</p>
            )}

            {/* Empty */}
            {!resLoading && resources?.length === 0 && (
              <div
                className="flex flex-col items-center justify-center rounded-lg py-14 text-center"
                style={{ border: '1px dashed var(--border-strong)' }}
              >
                <p className="text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>No resources yet</p>
                <p className="text-xs mb-4" style={{ color: 'var(--text-secondary)' }}>
                  Add a GET, POST… endpoint to this path.
                </p>
                <button
                  onClick={() => setResourceModal({ mode: 'create' })}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium"
                  style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-strong)', color: 'var(--text-primary)' }}
                >
                  <Plus size={13} /> New resource
                </button>
              </div>
            )}

            {/* Resource list */}
            <div className="flex flex-col gap-2">
              {resources?.map(r => (
                <ResourceRow
                  key={r.id}
                  resource={r}
                  projectId={projectId!}
                  pathId={selectedPathId}
                  projectSlug={projectSlug}
                  pathPath={selectedPath?.path ?? ''}
                  mockBaseUrl={mockBaseUrl}
                  onEdit={resource => setResourceModal({ mode: 'edit', resource })}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Modals */}
      {resourceModal?.mode === 'create' && selectedPathId && (
        <Modal title="New resource" onClose={() => setResourceModal(null)}>
          <ResourceForm
            projectId={projectId!}
            pathId={selectedPathId}
            onClose={() => setResourceModal(null)}
          />
        </Modal>
      )}
      {resourceModal?.mode === 'edit' && selectedPathId && (
        <Modal title="Edit resource" onClose={() => setResourceModal(null)}>
          <ResourceForm
            projectId={projectId!}
            pathId={selectedPathId}
            onClose={() => setResourceModal(null)}
            initial={resourceModal.resource}
          />
        </Modal>
      )}
    </div>
  )
}
