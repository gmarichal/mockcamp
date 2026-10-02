import { prisma } from './prisma.js'
import { AppError } from './errors.js'

// `requireProjectAccess`/`requireProjectAdmin` only check that the caller has a role on
// the :projectId in the URL — they never check that a deeper id (:pathId, :resourceId, ...)
// actually belongs to that project. Without these checks, a member of project A could act on
// project B's records just by supplying project B's id, which is not a secret: resource/response
// ids in particular are echoed on every mock response via X-MockCamp-Resource/-Response headers,
// with no auth required to read them.

export async function assertPathInProject(pathId: string, projectId: string) {
  const path = await prisma.path.findFirst({ where: { id: pathId, projectId } })
  if (!path) throw new AppError(404, 'Path not found')
}

export async function assertResourceInProject(resourceId: string, projectId: string) {
  const resource = await prisma.resource.findFirst({ where: { id: resourceId, path: { projectId } } })
  if (!resource) throw new AppError(404, 'Resource not found')
}

export async function assertResponseInProject(responseId: string, projectId: string) {
  const response = await prisma.response.findFirst({
    where: { id: responseId, resource: { path: { projectId } } },
  })
  if (!response) throw new AppError(404, 'Response not found')
}

export async function assertConditionInProject(conditionId: string, projectId: string) {
  const condition = await prisma.condition.findFirst({
    where: { id: conditionId, resource: { path: { projectId } } },
  })
  if (!condition) throw new AppError(404, 'Condition not found')
}

export async function assertVariableInProject(variableId: string, projectId: string) {
  const variable = await prisma.variable.findFirst({
    where: { id: variableId, OR: [{ projectId }, { resource: { path: { projectId } } }] },
  })
  if (!variable) throw new AppError(404, 'Variable not found')
}
