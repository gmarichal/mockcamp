import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { Path, PathNode } from '@/types'

// Build a tree from a flat list
export function buildTree(paths: Path[]): PathNode[] {
  const map = new Map<string, PathNode>()
  const roots: PathNode[] = []

  for (const p of paths) map.set(p.id, { ...p, children: [] })

  for (const node of map.values()) {
    if (node.parentId && map.has(node.parentId)) {
      map.get(node.parentId)!.children.push(node)
    } else {
      roots.push(node)
    }
  }

  return roots
}

export function usePaths(projectId: string) {
  return useQuery<Path[]>({
    queryKey: ['paths', projectId],
    queryFn: () => api.get(`/projects/${projectId}/paths`).then(r => r.data),
    enabled: !!projectId,
  })
}

export function useCreatePath(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { name: string; path: string; parentId?: string | null }) =>
      api.post(`/projects/${projectId}/paths`, body).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['paths', projectId] }),
  })
}

export function useUpdatePath(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ pathId, ...body }: { pathId: string; name?: string; path?: string }) =>
      api.patch(`/projects/${projectId}/paths/${pathId}`, body).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['paths', projectId] }),
  })
}

export function useDeletePath(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (pathId: string) =>
      api.delete(`/projects/${projectId}/paths/${pathId}`).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['paths', projectId] }),
  })
}
