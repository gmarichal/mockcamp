function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export async function applyDelay(resource: { delay: number | null; delayMin: number | null; delayMax: number | null }) {
  if (resource.delay != null && resource.delay > 0) {
    await sleep(resource.delay)
  } else if (resource.delayMin != null && resource.delayMax != null) {
    const ms = resource.delayMin + Math.random() * (resource.delayMax - resource.delayMin)
    await sleep(ms)
  }
}
