import { serve } from '@hono/node-server'
import { createNodeServer } from '../../packages/mizu-node/src/index.ts'
import { makeHonoApp, makeMizuApp } from '../fetch/apps.mts'

const arg = (name: string, fallback: string) =>
  process.argv.find((value) => value.startsWith(`--${name}=`))?.split('=')[1] ?? fallback
const framework = arg('framework', 'mizu')
const port = Number(arg('port', '3100'))

if (framework !== 'mizu' && framework !== 'hono') {
  throw new Error(`--framework must be mizu or hono, got ${framework}`)
}

const app = framework === 'mizu' ? makeMizuApp() : makeHonoApp()
const server = framework === 'mizu'
  ? createNodeServer(app).listen(port)
  : serve({ fetch: app.fetch, port })

server.once('listening', () => {
  process.stdout.write(`READY ${framework} ${port}\n`)
})

const close = () => server.close(() => process.exit(0))
process.once('SIGINT', close)
process.once('SIGTERM', close)
