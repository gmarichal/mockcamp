import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

export type Resource = {
  id: string
  pathId: string
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS'
  customPath: string | null
  isActive: boolean
  delay: number | null
  delayMin: number | null
  delayMax: number | null
  errorRate: number
  strategy: 'FIXED' | 'CONDITIONAL' | 'SEQUENTIAL' | 'RANDOM'
  seqIndex: number
  createdAt: string
  _count: { responses: number }
}

type ResourceInput = Partial<Omit<Resource, 'id' | 'pathId' | 'createdAt' | '_count'>>

function key(projectId: string, pathId: string) {
  return ['resources', projectId, pathId]
}

export function useResources(projectId: string, pathId: string | null) {
  return useQuery<Resource[]>({
    queryKey: key(projectId, pathId ?? ''),
    queryFn: () =>
      api.get(`/projects/${projectId}/paths/${pathId}/resources`).then(r => r.data),
    enabled: !!projectId && !!pathId,
  })
}

export function useCreateResource(projectId: string, pathId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: ResourceInput) =>
      api.post(`/projects/${projectId}/paths/${pathId}/resources`, body).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: key(projectId, pathId) })
      qc.invalidateQueries({ queryKey: ['paths', projectId] })
    },
  })
}

export function useUpdateResource(projectId: string, pathId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ resourceId, ...body }: ResourceInput & { resourceId: string }) =>
      api.patch(`/projects/${projectId}/paths/${pathId}/resources/${resourceId}`, body).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: key(projectId, pathId) }),
  })
}

export function useDeleteResource(projectId: string, pathId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (resourceId: string) =>
      api.delete(`/projects/${projectId}/paths/${pathId}/resources/${resourceId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: key(projectId, pathId) })
      qc.invalidateQueries({ queryKey: ['paths', projectId] })
    },
  })
}
