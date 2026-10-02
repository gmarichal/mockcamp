import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

export type ResponseHeader = { id: string; key: string; value: string }

export type MockResponse = {
  id: string
  resourceId: string
  name: string | null
  statusCode: number
  bodyType: 'JSON' | 'XML' | 'TEXT'
  body: string | null
  isDefault: boolean
  weight: number
  order: number
  createdAt: string
  headers: ResponseHeader[]
}

type ResponseInput = Omit<Partial<Omit<MockResponse, 'id' | 'resourceId' | 'createdAt'>>, 'headers'> & {
  headers?: { key: string; value: string }[]
}

function key(projectId: string, pathId: string, resourceId: string) {
  return ['responses', projectId, pathId, resourceId]
}

export function useResponses(projectId: string, pathId: string, resourceId: string | null) {
  return useQuery<MockResponse[]>({
    queryKey: key(projectId, pathId, resourceId ?? ''),
    queryFn: () =>
      api
        .get(`/projects/${projectId}/paths/${pathId}/resources/${resourceId}/responses`)
        .then(r => r.data),
    enabled: !!projectId && !!pathId && !!resourceId,
  })
}

export function useCreateResponse(projectId: string, pathId: string, resourceId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: ResponseInput) =>
      api
        .post(`/projects/${projectId}/paths/${pathId}/resources/${resourceId}/responses`, body)
        .then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: key(projectId, pathId, resourceId) })
      qc.invalidateQueries({ queryKey: ['resources', projectId, pathId] })
    },
  })
}

export function useUpdateResponse(projectId: string, pathId: string, resourceId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ responseId, ...body }: ResponseInput & { responseId: string }) =>
      api
        .patch(
          `/projects/${projectId}/paths/${pathId}/resources/${resourceId}/responses/${responseId}`,
          body,
        )
        .then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: key(projectId, pathId, resourceId) }),
  })
}

export function useDeleteResponse(projectId: string, pathId: string, resourceId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (responseId: string) =>
      api.delete(
        `/projects/${projectId}/paths/${pathId}/resources/${resourceId}/responses/${responseId}`,
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: key(projectId, pathId, resourceId) })
      qc.invalidateQueries({ queryKey: ['resources', projectId, pathId] })
    },
  })
}
