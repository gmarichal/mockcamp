import React, { useState } from 'react'
import { useParams } from 'react-router-dom'
import { ChevronRight, ChevronDown, Trash2, RefreshCw, ScrollText } from 'lucide-react'
import { useLogs, useClearLogs } from '@/hooks/useLogs'
import type { RequestLog } from '@/hooks/useLogs'

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

function statusColor(code: number) {
  if (code < 300) return '#68D391'
  if (code < 400) return '#F6AD55'
  return '#FC8181'
}

function formatTime(iso: string) {
  const d = new Date(iso)
  return d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
}

function formatDate(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

// ─── Body viewer ─────────────────────────────────────────────────────────────

function BodyViewer({ content }: { content: string | null }) {
  if (!content) return <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>— empty —</span>

  let pretty = content
  try {
    pretty = JSON.stringify(JSON.parse(content), null, 2)
  } catch { /* not JSON, show as-is */ }

  return (
    <pre
      className="text-xs font-mono overflow-auto rounded-md p-3"
      style={{
        background: 'var(--bg-base)',
        border: '1px solid var(--border)',
        color: 'var(--text-secondary)',
        maxHeight: 220,
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-all',
      }}
    >
      {pretty}
    </pre>
  )
}

// ─── Headers viewer ───────────────────────────────────────────────────────────

function HeadersViewer({ headers }: { headers: Record<string, string> | null }) {
  if (!headers || Object.keys(headers).length === 0) {
    return <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>— no headers —</span>
  }

  // Filter out noisy internal headers for readability
  const filtered = Object.entries(headers).filter(([k]) =>
    !['host', 'connection', 'content-length', 'transfer-encoding'].includes(k.toLowerCase())
  )

  return (
    <div className="flex flex-col gap-1">
      {filtered.map(([k, v]) => (
        <div key={k} className="flex gap-2 text-xs font-mono">
          <span style={{ color: 'var(--accent)', minWidth: 180, flexShrink: 0 }}>{k}</span>
          <span style={{ color: 'var(--text-secondary)', wordBreak: 'break-all' }}>{String(v)}</span>
        </div>
      ))}
    </div>
  )
}

// ─── Log Row ─────────────────────────────────────────────────────────────────

function LogRow({ log }: { log: RequestLog }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div style={{ borderBottom: '1px solid var(--border)' }}>
      {/* Level 1 — summary */}
      <div
        className="flex items-center gap-3 px-4 py-2.5 cursor-pointer group"
        style={{ background: 'var(--bg-surface)' }}
        onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)')}
        onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = 'var(--bg-surface)')}
        onClick={() => setExpanded(v => !v)}
      >
        {/* Expand chevron */}
        <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>
          {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        </span>

        {/* Timestamp */}
        <span className="text-xs font-mono flex-shrink-0" style={{ color: 'var(--text-muted)', minWidth: 130 }}>
          <span style={{ color: 'var(--text-secondary)' }}>{formatDate(log.createdAt)}</span>
          {' '}
          <span style={{ color: 'var(--text-primary)' }}>{formatTime(log.createdAt)}</span>
        </span>

        {/* Method badge */}
        <span
          className="text-xs font-mono font-bold px-2 py-0.5 rounded flex-shrink-0"
          style={{
            background: (METHOD_COLORS[log.method] ?? '#CBD5E0') + '22',
            color: METHOD_COLORS[log.method] ?? '#CBD5E0',
            minWidth: 60, textAlign: 'center',
          }}
        >
          {log.method}
        </span>

        {/* Path */}
        <span className="text-xs font-mono flex-1 truncate" style={{ color: 'var(--text-primary)' }}>
          {log.path}
        </span>

        {/* Status */}
        <span
          className="text-xs font-mono font-bold flex-shrink-0"
          style={{ color: statusColor(log.statusCode), minWidth: 36, textAlign: 'right' }}
        >
          {log.statusCode}
        </span>

        {/* Latency */}
        <span
          className="text-xs font-mono flex-shrink-0"
          style={{
            color: log.latencyMs > 1000 ? '#FC8181' : log.latencyMs > 300 ? '#F6AD55' : 'var(--text-muted)',
            minWidth: 64, textAlign: 'right',
          }}
        >
          {log.latencyMs}ms
        </span>
      </div>

      {/* Level 2 — request / response detail */}
      {expanded && (
        <div
          className="grid gap-0"
          style={{
            gridTemplateColumns: '1fr 1fr',
            borderTop: '1px solid var(--border)',
            background: 'var(--bg-elevated)',
          }}
        >
          {/* Request */}
          <div className="p-4 flex flex-col gap-3" style={{ borderRight: '1px solid var(--border)' }}>
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
              Request
            </p>

            <div>
              <p className="text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Headers</p>
              <HeadersViewer headers={log.requestHeaders} />
            </div>

            <div>
              <p className="text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Body</p>
              <BodyViewer content={log.requestBody} />
            </div>
          </div>

          {/* Response */}
          <div className="p-4 flex flex-col gap-3">
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
              Response
              <span
                className="ml-2 px-1.5 py-0.5 rounded font-mono"
                style={{ background: statusColor(log.statusCode) + '22', color: statusColor(log.statusCode) }}
              >
                {log.statusCode}
              </span>
            </p>

            <div>
              <p className="text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Headers</p>
              <HeadersViewer headers={log.responseHeaders} />
            </div>

            <div>
              <p className="text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Body</p>
              <BodyViewer content={log.responseBody} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']
const STATUS_FILTERS = [
  { label: 'All', value: '' },
  { label: '2xx', value: '200' },
  { label: '4xx', value: '404' },
  { label: '5xx', value: '500' },
]

export function LogsPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const [methodFilter, setMethodFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [offset, setOffset] = useState(0)
  const LIMIT = 50

  const { data, isLoading, refetch, isFetching } = useLogs(projectId!, {
    limit: LIMIT,
    offset,
    method: methodFilter || undefined,
    status: statusFilter || undefined,
  })
  const clearLogs = useClearLogs(projectId!)

  const logs = data?.logs ?? []
  const total = data?.total ?? 0
  const totalPages = Math.ceil(total / LIMIT)
  const currentPage = Math.floor(offset / LIMIT) + 1

  const handleClear = async () => {
    if (!confirm('Clear all logs for this project?')) return
    await clearLogs.mutateAsync()
    setOffset(0)
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div>
          <h1 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Request Logs</h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
            {total > 0 ? `${total} requests recorded` : 'No requests yet — make a call to the mock engine'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => refetch()}
            title="Refresh"
            className="p-1.5 rounded-md"
            style={{ color: isFetching ? 'var(--accent)' : 'var(--text-muted)', border: '1px solid var(--border-strong)' }}
          >
            <RefreshCw size={13} className={isFetching ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={handleClear}
            disabled={clearLogs.isPending || logs.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium disabled:opacity-40"
            style={{ color: 'var(--error)', border: '1px solid var(--border-strong)', background: 'var(--bg-surface)' }}
          >
            <Trash2 size={12} /> Clear
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 mb-3 flex-shrink-0 flex-wrap">
        {/* Method filter */}
        <div className="flex gap-1">
          <button
            onClick={() => { setMethodFilter(''); setOffset(0) }}
            className="px-2.5 py-1 rounded text-xs font-medium"
            style={{
              background: !methodFilter ? 'var(--accent)' : 'var(--bg-surface)',
              color: !methodFilter ? '#0F1117' : 'var(--text-muted)',
              border: `1px solid ${!methodFilter ? 'var(--accent)' : 'var(--border-strong)'}`,
            }}
          >
            All
          </button>
          {METHODS.map(m => (
            <button
              key={m}
              onClick={() => { setMethodFilter(methodFilter === m ? '' : m); setOffset(0) }}
              className="px-2.5 py-1 rounded text-xs font-mono font-bold"
              style={{
                background: methodFilter === m ? METHOD_COLORS[m] + '22' : 'var(--bg-surface)',
                color: METHOD_COLORS[m],
                border: `1px solid ${methodFilter === m ? METHOD_COLORS[m] : 'var(--border-strong)'}`,
              }}
            >
              {m}
            </button>
          ))}
        </div>

        <div style={{ width: 1, height: 20, background: 'var(--border-strong)' }} />

        {/* Status filter */}
        <div className="flex gap-1">
          {STATUS_FILTERS.map(f => (
            <button
              key={f.value}
              onClick={() => { setStatusFilter(statusFilter === f.value ? '' : f.value); setOffset(0) }}
              className="px-2.5 py-1 rounded text-xs font-mono"
              style={{
                background: statusFilter === f.value ? 'var(--bg-hover)' : 'var(--bg-surface)',
                color: f.value === '' ? 'var(--text-muted)'
                  : f.value === '200' ? '#68D391'
                  : f.value === '404' ? '#F6AD55'
                  : '#FC8181',
                border: `1px solid ${statusFilter === f.value ? 'var(--border-strong)' : 'var(--border)'}`,
                fontWeight: statusFilter === f.value ? 600 : 400,
              }}
            >
              {f.label}
            </button>
          ))}
        </div>

        <span className="ml-auto text-xs" style={{ color: 'var(--text-muted)' }}>
          Auto-refresh every 5s
        </span>
      </div>

      {/* Loading */}
      {isLoading && (
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Loading…</p>
      )}

      {/* Empty state */}
      {!isLoading && logs.length === 0 && (
        <div
          className="flex flex-col items-center justify-center rounded-lg py-16 text-center flex-1"
          style={{ border: '1px dashed var(--border-strong)' }}
        >
          <div
            className="flex items-center justify-center rounded-lg mb-4"
            style={{ width: 44, height: 44, background: 'var(--bg-elevated)', border: '1px solid var(--border-strong)' }}
          >
            <ScrollText size={20} style={{ color: 'var(--accent)' }} />
          </div>
          <p className="text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>No logs yet</p>
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            Requests to the mock engine appear here automatically.
          </p>
        </div>
      )}

      {/* Log list */}
      {logs.length > 0 && (
        <div className="flex flex-col flex-1 min-h-0 overflow-y-auto rounded-lg" style={{ border: '1px solid var(--border)' }}>
          {/* Column headers */}
          <div
            className="flex items-center gap-3 px-4 py-2 sticky top-0 z-10"
            style={{ background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border)' }}
          >
            <span style={{ width: 13 }} />
            <span className="text-xs font-semibold uppercase tracking-wider flex-shrink-0" style={{ color: 'var(--text-muted)', minWidth: 130 }}>Timestamp</span>
            <span className="text-xs font-semibold uppercase tracking-wider flex-shrink-0" style={{ color: 'var(--text-muted)', minWidth: 60 }}>Method</span>
            <span className="text-xs font-semibold uppercase tracking-wider flex-1" style={{ color: 'var(--text-muted)' }}>Path</span>
            <span className="text-xs font-semibold uppercase tracking-wider flex-shrink-0" style={{ color: 'var(--text-muted)', minWidth: 36, textAlign: 'right' }}>Status</span>
            <span className="text-xs font-semibold uppercase tracking-wider flex-shrink-0" style={{ color: 'var(--text-muted)', minWidth: 64, textAlign: 'right' }}>Latency</span>
          </div>

          {logs.map(log => <LogRow key={log.id} log={log} />)}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-3 flex-shrink-0">
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Page {currentPage} of {totalPages}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setOffset(Math.max(0, offset - LIMIT))}
              disabled={offset === 0}
              className="px-3 py-1.5 rounded-md text-xs font-medium disabled:opacity-40"
              style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', color: 'var(--text-secondary)' }}
            >
              ← Prev
            </button>
            <button
              onClick={() => setOffset(offset + LIMIT)}
              disabled={offset + LIMIT >= total}
              className="px-3 py-1.5 rounded-md text-xs font-medium disabled:opacity-40"
              style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', color: 'var(--text-secondary)' }}
            >
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
