import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

export type RequestLog = {
  id: string
  method: string
  path: string
  statusCode: number
  latencyMs: number
  requestHeaders: Record<string, string> | null
  requestBody: string | null
  responseHeaders: Record<string, string> | null
  responseBody: string | null
  resourceId: string | null
  createdAt: string
}

type LogsResponse = {
  total: number
  logs: RequestLog[]
}

type LogFilters = {
  limit?: number
  offset?: number
  method?: string
  status?: string
}

export function useLogs(projectId: string, filters: LogFilters = {}) {
  const params = new URLSearchParams()
  if (filters.limit)  params.set('limit',  String(filters.limit))
  if (filters.offset) params.set('offset', String(filters.offset))
  if (filters.method) params.set('method', filters.method)
  if (filters.status) params.set('status', filters.status)

  return useQuery<LogsResponse>({
    queryKey: ['logs', projectId, filters],
    queryFn: () =>
      api.get(`/projects/${projectId}/logs?${params}`).then(r => r.data),
    enabled: !!projectId,
    refetchInterval: 5000, // auto-refresh cada 5s
  })
}

export function useClearLogs(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => api.delete(`/projects/${projectId}/logs`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['logs', projectId] }),
  })
}
