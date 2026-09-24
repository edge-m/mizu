import { expect, test } from 'vitest';
import { z } from 'zod';
import { createApp, createNodeServer } from '../src/index.js';

const healthRequest = {
  headers: z.object({
    authorization: z.string(),
  }),
};

const healthResponse = {
  200: z.object({
    ok: z.boolean(),
  }),
};

test('serves a typed GET route through the Web Standard fetch API', async () => {
  const app = createApp();

  app.get(
    '/health',
    {
      request: healthRequest,
      response: healthResponse,
    },
    async ({ headers }) => {
      expect(headers.authorization).toBe('Bearer test');

      return {
        status: 200,
        body: { ok: true },
      };
    },
  );

  const response = await app.fetch(
    new Request('http://localhost/health', {
      headers: { authorization: 'Bearer test' },
    }),
  );

  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ ok: true });
});

test('returns 400 when a declared header is invalid', async () => {
  const app = createApp();

  app.get(
    '/health',
    {
      request: healthRequest,
      response: healthResponse,
    },
    async () => ({
      status: 200,
      body: { ok: true },
    }),
  );

  const response = await app.fetch(new Request('http://localhost/health'));

  expect(response.status).toBe(400);
});

test('returns 404 when no route matches', async () => {
  const app = createApp();

  const response = await app.fetch(new Request('http://localhost/missing'));

  expect(response.status).toBe(404);
});

test('serves the same app through the Node.js adapter', async () => {
  const app = createApp();

  app.get(
    '/health',
    {
      request: { headers: healthRequest.headers },
      response: healthResponse,
    },
    async () => ({
      status: 200,
      body: { ok: true },
    }),
  );

  const server = createNodeServer(app).listen(0);
  await new Promise<void>((resolve) => server.once('listening', resolve));

  try {
    const address = server.address();
    if (!address || typeof address === 'string') {
      throw new Error('Server did not expose a TCP address');
    }

    const response = await fetch(`http://127.0.0.1:${address.port}/health`, {
      headers: { authorization: 'Bearer test' },
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
});
