import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

type ServerConfig = {
  status: string
  version: string
  mockBaseUrl: string
}

export function useServerConfig() {
  return useQuery<ServerConfig>({
    queryKey: ['server-config'],
    queryFn: () => api.get('/health').then(r => r.data),
    staleTime: Infinity, // no cambia en runtime
  })
}
