import { createApp } from '../src/index.js';
import { createNodeServer } from '../packages/mizu-node/src/index.js';
import { expect, test } from 'vitest';
import { z } from 'zod';

async function withServer<T>(
  app: ReturnType<typeof createApp>,
  callback: (baseUrl: string) => Promise<T>,
): Promise<T> {
  const server = createNodeServer(app).listen(0);
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') {
    server.close();
    throw new Error('server did not bind to a TCP address');
  }

  try {
    return await callback(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
}

test('mizu-node package entry serves a core app', async () => {
  const app = createApp();
  app.get('/health', {}, async () => ({
    status: 200,
    body: { ok: true },
    headers: { 'x-runtime': 'node' },
  }));

  const server = createNodeServer(app).listen(0);
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('not listening');

  try {
    const response = await fetch(`http://127.0.0.1:${address.port}/health`);
    expect(response.status).toBe(200);
    expect(response.headers.get('x-runtime')).toBe('node');
    expect(await response.json()).toEqual({ ok: true });
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});

test('mizu-node package entry forwards a JSON request body', async () => {
  const app = createApp();
  app.post(
    '/echo',
    { request: { body: z.object({ message: z.string() }) } },
    async ({ body }) => ({ status: 200, body }),
  );

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/echo`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message: 'hello' }),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ message: 'hello' });
  });
});
