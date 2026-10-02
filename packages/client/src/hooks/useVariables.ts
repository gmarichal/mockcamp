import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

export type Variable = {
  id: string
  name: string
  type: 'STATIC' | 'DYNAMIC'
  value: string | null
  expression: string | null
  projectId: string | null
  resourceId: string | null
  createdAt: string
  updatedAt: string
}

type VariableInput = {
  name: string
  type: Variable['type']
  value?: string | null
  expression?: string | null
  resourceId?: string | null
}

export function useVariables(projectId: string) {
  return useQuery<Variable[]>({
    queryKey: ['variables', projectId],
    queryFn: () => api.get(`/projects/${projectId}/variables`).then(r => r.data),
    enabled: !!projectId,
  })
}

export function useCreateVariable(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: VariableInput) =>
      api.post(`/projects/${projectId}/variables`, body).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['variables', projectId] }),
  })
}

export function useUpdateVariable(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ variableId, ...body }: Partial<VariableInput> & { variableId: string }) =>
      api.patch(`/projects/${projectId}/variables/${variableId}`, body).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['variables', projectId] }),
  })
}

export function useDeleteVariable(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (variableId: string) =>
      api.delete(`/projects/${projectId}/variables/${variableId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['variables', projectId] }),
  })
}
