import { expect, test } from 'vitest';
import { createApp } from '../src/index.js';

test('exposes the matched request through handler context', async () => {
  const app = createApp();

  app.get('/hello', {}, async ({ ctx }) => {
    expect(ctx.request.method).toBe('GET');
    expect(ctx.url.pathname).toBe('/hello');
    expect(ctx.signal).toBeInstanceOf(AbortSignal);

    return ctx.text('hello', 201);
  });

  const response = await app.fetch(new Request('http://localhost/hello'));

  expect(response.status).toBe(201);
  expect(await response.text()).toBe('hello');
});

test('response helpers preserve headers and response body conventions', async () => {
  const app = createApp();

  app.get('/json', {}, async ({ ctx }) => {
    ctx.header('x-context', 'yes');
    return ctx.json({ ok: true });
  });
  app.get('/empty', {}, async ({ ctx }) => ctx.empty());
  app.get('/stream', {}, async ({ ctx }) =>
    ctx.stream(new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('chunk'));
        controller.close();
      },
    })),
  );

  const jsonResponse = await app.fetch(new Request('http://localhost/json'));
  expect(jsonResponse.headers.get('content-type')).toContain('application/json');
  expect(jsonResponse.headers.get('x-context')).toBe('yes');
  expect(await jsonResponse.json()).toEqual({ ok: true });

  const emptyResponse = await app.fetch(new Request('http://localhost/empty'));
  expect(emptyResponse.status).toBe(204);
  expect(await emptyResponse.text()).toBe('');

  const streamResponse = await app.fetch(new Request('http://localhost/stream'));
  expect(await streamResponse.text()).toBe('chunk');
});

test('set and get share typed request-scoped values', async () => {
  const app = createApp();

  app.get('/value', {}, async ({ ctx }) => {
    ctx.set('requestId', 'req-123');
    return ctx.text(ctx.get('requestId'));
  });

  const response = await app.fetch(new Request('http://localhost/value'));
  expect(await response.text()).toBe('req-123');
});
