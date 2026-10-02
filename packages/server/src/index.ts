import { buildApp } from './app.js'

const PORT = Number(process.env.PORT) || 3000
const HOST = process.env.HOST || '0.0.0.0'

const app = await buildApp()

try {
  await app.listen({ port: PORT, host: HOST })
  console.log(`\n🏕️  MockCamp server running at http://localhost:${PORT}`)
  console.log(`   Admin panel: http://localhost:${PORT}/_admin`)
  console.log(`   API:         http://localhost:${PORT}/_admin/api\n`)
} catch (err) {
  app.log.error(err)
  process.exit(1)
}
