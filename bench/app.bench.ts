import { afterAll, bench, describe } from 'vitest';
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { createApp } from '../src/index.js';
import { createNodeServer } from '../packages/mizu-node/src/index.js';

const comparableBenchOptions = {
  time: 1_000,
  warmupTime: 250,
};

const bodyRequest = () => new Request('http://localhost/todos', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ title: 'bench' }),
});

const staticApp = createApp();
staticApp.get('/health', {}, async () => ({
  status: 200,
  body: { ok: true },
}));

const paramsApp = createApp();
paramsApp.get(
  '/todos/:id',
  { request: { params: z.object({ id: z.string() }) } },
  async ({ params }) => ({ status: 200, body: { id: params.id } }),
);

const headersApp = createApp();
headersApp.get(
  '/health',
  { request: { headers: z.object({ authorization: z.string() }) } },
  async () => ({ status: 200, body: { ok: true } }),
);

const queryApp = createApp();
queryApp.get(
  '/todos',
  { request: { query: z.object({ limit: z.coerce.number() }) } },
  async ({ query }) => ({ status: 200, body: { limit: query.limit } }),
);

const bodyApp = createApp();
bodyApp.post(
  '/todos',
  { request: { body: z.object({ title: z.string() }) } },
  async ({ body }) => ({ status: 201, body }),
);

const responseApp = createApp();
responseApp.get(
  '/health',
  { response: { 200: z.object({ ok: z.boolean() }) } },
  async () => ({ status: 200, body: { ok: true } }),
);

const middlewareApp = createApp();
middlewareApp.use(async (_request, next) => next());
middlewareApp.get('/health', {}, async () => ({
  status: 200,
  body: { ok: true },
}));

const honoStatic = new Hono();
honoStatic.get('/health', async (context) => context.json({ ok: true }));

const honoParams = new Hono();
honoParams.get('/todos/:id', async (context) =>
  context.json({ id: context.req.param('id') }),
);

const honoHeaders = new Hono();
honoHeaders.get(
  '/health',
  zValidator('header', z.object({ authorization: z.string() })),
  async (context) => context.json({ ok: true }),
);

const honoQuery = new Hono();
honoQuery.get(
  '/todos',
  zValidator('query', z.object({ limit: z.coerce.number() })),
  async (context) => context.json({ limit: context.req.valid('query').limit }),
);

const honoBody = new Hono();
honoBody.post(
  '/todos',
  zValidator('json', z.object({ title: z.string() })),
  async (context) => context.json(context.req.valid('json'), 201),
);

const honoResponse = new Hono();
honoResponse.get('/health', async (context) => {
  const result = z.object({ ok: z.boolean() }).parse({ ok: true });
  return context.json(result);
});

const honoMiddleware = new Hono();
honoMiddleware.use('*', async (_context, next) => next());
honoMiddleware.get('/health', async (context) => context.json({ ok: true }));

const staticRequest = new Request('http://localhost/health');
const paramsRequest = new Request('http://localhost/todos/1');
const headersRequest = new Request('http://localhost/health', {
  headers: { authorization: 'Bearer bench' },
});
const queryRequest = new Request('http://localhost/todos?limit=10');
const responseRequest = new Request('http://localhost/health');
const middlewareRequest = new Request('http://localhost/health');

const routeCounts = [1, 10, 100, 256, 512, 513, 1_000];
const mizuRouteCountApps = routeCounts.map((count) => {
  const app = createApp();
  for (let index = 0; index < count; index += 1) {
    app.get(`/items/:id/action-${index}`, {}, async ({ params }) => ({
      status: 200,
      body: { id: params.id, action: index },
    }));
  }
  return app;
});

const honoRouteCountApps = routeCounts.map((count) => {
  const app = new Hono();
  for (let index = 0; index < count; index += 1) {
    app.get(`/items/:id/action-${index}`, async (context) =>
      context.json({ id: context.req.param('id'), action: index }),
    );
  }
  return app;
});

describe('mizu core', () => {
  bench('static route dispatch', async () => {
    await staticApp.fetch(staticRequest);
  }, comparableBenchOptions);

  bench('params route dispatch', async () => {
    await paramsApp.fetch(paramsRequest);
  }, comparableBenchOptions);

  bench('headers validation', async () => {
    await headersApp.fetch(headersRequest);
  }, comparableBenchOptions);

  bench('query validation', async () => {
    await queryApp.fetch(queryRequest);
  }, comparableBenchOptions);

  bench('JSON body validation', async () => {
    await bodyApp.fetch(bodyRequest());
  }, comparableBenchOptions);

  bench('response validation', async () => {
    await responseApp.fetch(responseRequest);
  }, comparableBenchOptions);

  bench('middleware', async () => {
    await middlewareApp.fetch(middlewareRequest);
  }, comparableBenchOptions);
});

describe('hono core', () => {
  bench('static route dispatch', async () => {
    await honoStatic.fetch(staticRequest);
  }, comparableBenchOptions);

  bench('params route dispatch', async () => {
    await honoParams.fetch(paramsRequest);
  }, comparableBenchOptions);

  bench('headers validation', async () => {
    await honoHeaders.fetch(headersRequest);
  }, comparableBenchOptions);

  bench('query validation', async () => {
    await honoQuery.fetch(queryRequest);
  }, comparableBenchOptions);

  bench('JSON body validation', async () => {
    await honoBody.fetch(bodyRequest());
  }, comparableBenchOptions);

  bench('response validation', async () => {
    await honoResponse.fetch(responseRequest);
  }, comparableBenchOptions);

  bench('middleware', async () => {
    await honoMiddleware.fetch(middlewareRequest);
  }, comparableBenchOptions);
});

describe('route dispatch by route count', () => {
  for (const [index, count] of routeCounts.entries()) {
    const request = new Request(`http://localhost/items/42/action-${count - 1}`);

    bench(`mizu ${count} dynamic routes`, async () => {
      await mizuRouteCountApps[index].fetch(request);
    }, comparableBenchOptions);

    bench(`hono ${count} dynamic routes`, async () => {
      await honoRouteCountApps[index].fetch(request);
    }, comparableBenchOptions);
  }
});

describe('mizu Node adapter', () => {
  bench(
    'HTTP fetch through Node adapter',
    async () => {
      const response = await fetch(nodeAdapterUrl);
      await response.arrayBuffer();
    },
    comparableBenchOptions,
  );
});

const nodeAdapterServer = createNodeServer(staticApp).listen(0);
await new Promise<void>((resolve) => nodeAdapterServer.once('listening', resolve));
const nodeAdapterAddress = nodeAdapterServer.address();
if (!nodeAdapterAddress || typeof nodeAdapterAddress === 'string') {
  throw new Error('Server did not expose a TCP address');
}
const nodeAdapterUrl = `http://127.0.0.1:${nodeAdapterAddress.port}/health`;

const honoNodeServer = serve({ fetch: honoStatic.fetch, port: 0 });
await new Promise<void>((resolve) => honoNodeServer.once('listening', resolve));
const honoNodeAddress = honoNodeServer.address();
if (!honoNodeAddress || typeof honoNodeAddress === 'string') {
  throw new Error('Hono server did not expose a TCP address');
}
const honoNodeUrl = `http://127.0.0.1:${honoNodeAddress.port}/health`;

describe('hono Node adapter', () => {
  bench(
    'HTTP fetch through Node adapter',
    async () => {
      const response = await fetch(honoNodeUrl);
      await response.arrayBuffer();
    },
    comparableBenchOptions,
  );
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => {
    nodeAdapterServer.close((error) => (error ? reject(error) : resolve()));
  });
  await new Promise<void>((resolve, reject) => {
    honoNodeServer.close((error) => (error ? reject(error) : resolve()));
  });
});
