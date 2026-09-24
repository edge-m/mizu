import { afterAll, bench, describe } from 'vitest';
import { z } from 'zod';
import { createApp, createNodeServer } from '../src/index.js';

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

const staticRequest = new Request('http://localhost/health');
const paramsRequest = new Request('http://localhost/todos/1');
const headersRequest = new Request('http://localhost/health', {
  headers: { authorization: 'Bearer bench' },
});
const queryRequest = new Request('http://localhost/todos?limit=10');
const responseRequest = new Request('http://localhost/health');
const middlewareRequest = new Request('http://localhost/health');

describe('mizu core', () => {
  bench('static route dispatch', async () => {
    await staticApp.fetch(staticRequest);
  });

  bench('params route dispatch', async () => {
    await paramsApp.fetch(paramsRequest);
  });

  bench('headers validation', async () => {
    await headersApp.fetch(headersRequest);
  });

  bench('query validation', async () => {
    await queryApp.fetch(queryRequest);
  });

  bench('JSON body validation', async () => {
    await bodyApp.fetch(
      new Request('http://localhost/todos', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title: 'bench' }),
      }),
    );
  });

  bench('response validation', async () => {
    await responseApp.fetch(responseRequest);
  });

  bench('middleware', async () => {
    await middlewareApp.fetch(middlewareRequest);
  });
});

describe('mizu Node adapter', () => {
  bench(
    'HTTP fetch through Node adapter',
    async () => {
      const response = await fetch(nodeAdapterUrl);
      await response.arrayBuffer();
    },
    { iterations: 20 },
  );
});

const nodeAdapterServer = createNodeServer(staticApp).listen(0);
await new Promise<void>((resolve) => nodeAdapterServer.once('listening', resolve));
const nodeAdapterAddress = nodeAdapterServer.address();
if (!nodeAdapterAddress || typeof nodeAdapterAddress === 'string') {
  throw new Error('Server did not expose a TCP address');
}
const nodeAdapterUrl = `http://127.0.0.1:${nodeAdapterAddress.port}/health`;

afterAll(async () => {
  await new Promise<void>((resolve, reject) => {
    nodeAdapterServer.close((error) => (error ? reject(error) : resolve()));
  });
});
