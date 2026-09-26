import { expect, test } from 'vitest';
import { z } from 'zod';
import { bodyLimit, createApp } from '../src/index.js';

function streamedBody(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
}

test('rejects a request whose declared body exceeds the limit', async () => {
  const app = createApp();
  app.use(bodyLimit(10));
  app.post('/', {}, async () => ({ status: 200, body: 'ok' }));

  const response = await app.fetch(
    new Request('http://localhost/', {
      method: 'POST',
      headers: { 'content-length': '11' },
      body: 'hello world',
    }),
  );

  expect(response.status).toBe(413);
  expect(await response.text()).toBe('Payload Too Large');
});

test('allows a request within the body limit', async () => {
  const app = createApp();
  app.use(bodyLimit(10));
  app.post('/', {}, async () => ({ status: 200, body: 'ok' }));

  const response = await app.fetch(
    new Request('http://localhost/', {
      method: 'POST',
      headers: { 'content-length': '5' },
      body: 'hello',
    }),
  );

  expect(response.status).toBe(200);
});

test('rejects a chunked body when it exceeds the limit', async () => {
  const app = createApp();
  app.use(bodyLimit(10));
  app.post(
    '/',
    { request: { body: z.object({ message: z.string() }) } },
    async () => ({ status: 200, body: 'ok' }),
  );

  const response = await app.fetch(
    new Request('http://localhost/', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: streamedBody(['{"message":', '"too long"}']),
      duplex: 'half',
    } as RequestInit & { duplex: 'half' }),
  );

  expect(response.status).toBe(413);
  expect(await response.text()).toBe('Payload Too Large');
});

test('passes a chunked body through when it stays within the limit', async () => {
  const app = createApp();
  app.use(bodyLimit(32));
  app.post(
    '/',
    { request: { body: z.object({ message: z.string() }) } },
    async ({ body }) => ({ status: 200, body: body.message }),
  );

  const response = await app.fetch(
    new Request('http://localhost/', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: streamedBody(['{"message":', '"ok"}']),
      duplex: 'half',
    } as RequestInit & { duplex: 'half' }),
  );

  expect(response.status).toBe(200);
  expect(await response.text()).toBe('ok');
});
