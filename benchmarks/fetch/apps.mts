import { Hono } from 'hono'
import { RegExpRouter } from 'hono/router/reg-exp-router'
import { createApp } from '../../src/index.ts'

export const cases = [
  'ping GET /',
  'json GET /user',
  'path/query GET /id/1?name=bench',
  'multi-route GET /items/42/action-3',
  'body POST /json',
  'middleware GET /mw/hello',
] as const

export type BenchmarkCase = (typeof cases)[number]

export function makeMizuApp() {
  const app = createApp()
  app.get('/', {}, async ({ ctx }) => ctx.text('Hi'))
  app.get('/user', {}, async ({ ctx }) =>
    ctx.json({ id: 123, name: 'Alice', roles: ['admin', 'editor'] }),
  )
  app.get('/id/:id', {}, async ({ ctx, params }) => {
    ctx.header('x-powered-by', 'benchmark')
    return ctx.text(`${params.id} ${ctx.url.searchParams.get('name')}`)
  })
  app.get('/items/:id/action-0', {}, async ({ ctx, params }) =>
    ctx.json({ id: params.id, action: 0 }),
  )
  app.get('/items/:id/action-1', {}, async ({ ctx, params }) =>
    ctx.json({ id: params.id, action: 1 }),
  )
  app.get('/items/:id/action-2', {}, async ({ ctx, params }) =>
    ctx.json({ id: params.id, action: 2 }),
  )
  app.get('/items/:id/action-3', {}, async ({ ctx, params }) =>
    ctx.json({ id: params.id, action: 3 }),
  )
  app.post('/json', {}, async ({ ctx }) =>
    ctx.json(await ctx.request.json()),
  )
  app.use('/mw/*', async (_request, next) => next())
  app.get('/mw/hello', {}, async ({ ctx }) => ctx.text('mw'))
  return app
}

export function makeHonoApp() {
  const app = new Hono({ router: new RegExpRouter() })
  app.get('/', (c) => c.text('Hi'))
  app.get('/user', (c) => c.json({ id: 123, name: 'Alice', roles: ['admin', 'editor'] }))
  app.get('/id/:id', (c) => {
    const id = c.req.param('id')
    const name = c.req.query('name')
    c.header('x-powered-by', 'benchmark')
    return c.text(`${id} ${name}`)
  })
  app.get('/items/:id/action-0', (c) => c.json({ id: c.req.param('id'), action: 0 }))
  app.get('/items/:id/action-1', (c) => c.json({ id: c.req.param('id'), action: 1 }))
  app.get('/items/:id/action-2', (c) => c.json({ id: c.req.param('id'), action: 2 }))
  app.get('/items/:id/action-3', (c) => c.json({ id: c.req.param('id'), action: 3 }))
  app.post('/json', (c) => c.req.json().then((body) => c.json(body)))
  app.use('/mw/*', async (_c, next) => next())
  app.get('/mw/hello', (c) => c.text('mw'))
  return app
}

export function makeRequests() {
  return {
    ping: new Request('http://localhost/'),
    json: new Request('http://localhost/user'),
    pathQuery: new Request('http://localhost/id/1?name=bench'),
    multiRoute: new Request('http://localhost/items/42/action-3'),
    body: () => new Request('http://localhost/json', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{"hello":"world"}',
    }),
    middleware: new Request('http://localhost/mw/hello'),
  }
}

export function getCaseRequest(name: BenchmarkCase, requests: ReturnType<typeof makeRequests>) {
  if (name.startsWith('ping')) return requests.ping
  if (name.startsWith('json')) return requests.json
  if (name.startsWith('path/query')) return requests.pathQuery
  if (name.startsWith('multi-route')) return requests.multiRoute
  if (name.startsWith('body')) return requests.body()
  return requests.middleware
}
