import type { FastifyRequest, FastifyReply } from 'fastify'
import { prisma } from './prisma.js'
import { AppError } from './errors.js'

export type JwtPayload = {
  userId: string
  isAdmin: boolean
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: JwtPayload
    user: JwtPayload
  }
}

/** Verifies JWT and attaches user to request. */
export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  try {
    await request.jwtVerify()
  } catch {
    throw new AppError(401, 'Unauthorized')
  }
}

/** Only global admins. */
export async function requireAdmin(request: FastifyRequest, _reply: FastifyReply) {
  await authenticate(request, _reply)
  if (!request.user.isAdmin) {
    throw new AppError(403, 'Admin access required')
  }
}

/** The caller's role on the given project, or null if they have none. Global admins short-circuit. */
async function getProjectRole(
  request: FastifyRequest<{ Params: { projectId: string } }>,
  reply: FastifyReply,
): Promise<'ADMIN' | 'PROJECT_ADMIN' | 'TESTER' | null> {
  await authenticate(request, reply)
  if (request.user.isAdmin) return 'ADMIN'

  const role = await prisma.projectRole.findUnique({
    where: {
      userId_projectId: {
        userId: request.user.userId,
        projectId: request.params.projectId,
      },
    },
  })
  return role?.role ?? null
}

/** Admin OR has any role in the given project. */
export async function requireProjectAccess(
  request: FastifyRequest<{ Params: { projectId: string } }>,
  reply: FastifyReply,
) {
  const role = await getProjectRole(request, reply)
  if (!role) throw new AppError(403, 'No access to this project')
}

/** Admin OR Project Admin of the given project. */
export async function requireProjectAdmin(
  request: FastifyRequest<{ Params: { projectId: string } }>,
  reply: FastifyReply,
) {
  const role = await getProjectRole(request, reply)
  if (role !== 'ADMIN' && role !== 'PROJECT_ADMIN') {
    throw new AppError(403, 'Project admin access required')
  }
}
