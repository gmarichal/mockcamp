import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

export type Condition = {
  id: string
  resourceId: string
  responseId: string
  expression: string
  order: number
}

type ConditionInput = { responseId: string; expression: string; order?: number }

function key(projectId: string, pathId: string, resourceId: string) {
  return ['conditions', projectId, pathId, resourceId]
}

function url(projectId: string, pathId: string, resourceId: string) {
  return `/projects/${projectId}/paths/${pathId}/resources/${resourceId}/conditions`
}

export function useConditions(projectId: string, pathId: string, resourceId: string | null) {
  return useQuery<Condition[]>({
    queryKey: key(projectId, pathId, resourceId ?? ''),
    queryFn: () => api.get(url(projectId, pathId, resourceId!)).then(r => r.data),
    enabled: !!resourceId,
  })
}

export function useCreateCondition(projectId: string, pathId: string, resourceId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: ConditionInput) =>
      api.post(url(projectId, pathId, resourceId), body).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: key(projectId, pathId, resourceId) }),
  })
}

export function useUpdateCondition(projectId: string, pathId: string, resourceId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ conditionId, ...body }: Partial<ConditionInput> & { conditionId: string }) =>
      api.patch(`${url(projectId, pathId, resourceId)}/${conditionId}`, body).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: key(projectId, pathId, resourceId) }),
  })
}

export function useDeleteCondition(projectId: string, pathId: string, resourceId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (conditionId: string) =>
      api.delete(`${url(projectId, pathId, resourceId)}/${conditionId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: key(projectId, pathId, resourceId) }),
  })
}
