import assert from 'node:assert/strict'
import { getCaseRequest, makeHonoApp, makeMizuApp, makeRequests, cases } from './apps.mts'

async function snapshot(app: { fetch(request: Request): Promise<Response> }, name: typeof cases[number]) {
  const response = await app.fetch(getCaseRequest(name, makeRequests()))
  return {
    status: response.status,
    body: await response.text(),
    poweredBy: response.headers.get('x-powered-by'),
  }
}

const mizu = makeMizuApp()
const hono = makeHonoApp()
for (const name of cases) {
  assert.deepEqual(await snapshot(mizu, name), await snapshot(hono, name), name)
}
console.log(`fetch smoke: ${cases.length} cases passed`)
