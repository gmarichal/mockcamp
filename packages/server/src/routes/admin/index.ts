import type { FastifyInstance } from 'fastify'
import { authRoutes } from './auth.js'
import { userRoutes } from './users.js'
import { projectRoutes } from './projects.js'
import { pathRoutes } from './paths.js'
import { resourceRoutes } from './resources.js'
import { responseRoutes } from './responses.js'
import { conditionRoutes } from './conditions.js'
import { variableRoutes } from './variables.js'
import { logRoutes } from './logs.js'

export async function adminRoutes(app: FastifyInstance) {
  app.get('/api/health', async (request) => {
    const port = process.env.PORT || '3000'
    const host = request.hostname.split(':')[0]
    const mockBaseUrl = process.env.PUBLIC_SERVER_URL || `http://${host}:${port}`
    return {
      status: 'ok',
      version: '0.1.0',
      timestamp: new Date().toISOString(),
      mockBaseUrl,
    }
  })

  await app.register(authRoutes,      { prefix: '/api/auth' })
  await app.register(userRoutes,      { prefix: '/api/users' })
  await app.register(projectRoutes,   { prefix: '/api/projects' })
  await app.register(pathRoutes,      { prefix: '/api/projects' })
  await app.register(resourceRoutes,  { prefix: '/api/projects' })
  await app.register(responseRoutes,  { prefix: '/api/projects' })
  await app.register(conditionRoutes, { prefix: '/api/projects' })
  await app.register(variableRoutes,  { prefix: '/api/projects' })
  await app.register(logRoutes,       { prefix: '/api/projects' })
}
