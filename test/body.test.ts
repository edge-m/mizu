import { expect, test } from 'vitest';
import { z } from 'zod';
import { createApp } from '../src/index.js';

function bodyApp() {
  const app = createApp();
  app.post('/body', { request: { body: z.any() } }, async ({ body }) => ({
    status: 200,
    body: body instanceof ArrayBuffer
      ? { kind: 'arrayBuffer', bytes: [...new Uint8Array(body)] }
      : body instanceof Blob
        ? { kind: 'blob', size: body.size, type: body.type }
        : body instanceof FormData
          ? Object.fromEntries(body.entries())
          : body,
  }));
  return app;
}

test.each([
  ['text/plain', 'hello'],
  ['application/x-www-form-urlencoded', { message: 'hello', tag: ['one', 'two'] }],
])('extracts %s request bodies', async (contentType, body) => {
  const app = bodyApp();
  const input = typeof body === 'string'
    ? body
    : 'message=hello&tag=one&tag=two';

  const response = await app.fetch(new Request('http://localhost/body', {
    method: 'POST',
    headers: { 'content-type': contentType },
    body: input,
  }));

  if (contentType === 'text/plain') {
    expect(await response.text()).toBe(body);
  } else {
    expect(await response.json()).toEqual(body);
  }
});

test('extracts multipart, arrayBuffer, and blob bodies', async () => {
  const app = bodyApp();
  const form = new FormData();
  form.append('message', 'hello');
  const multipart = await app.fetch(new Request('http://localhost/body', {
    method: 'POST',
    body: form,
  }));
  expect((await multipart.json()).message).toBe('hello');

  const binary = await app.fetch(new Request('http://localhost/body', {
    method: 'POST',
    headers: { 'content-type': 'application/octet-stream' },
    body: new Uint8Array([1, 2, 3]),
  }));
  expect(await binary.json()).toEqual({
    kind: 'arrayBuffer',
    bytes: [1, 2, 3],
  });

  const blob = await app.fetch(new Request('http://localhost/body', {
    method: 'POST',
    headers: { 'content-type': 'image/png' },
    body: new Uint8Array([4, 5]),
  }));
  expect(await blob.json()).toEqual({ kind: 'blob', size: 2, type: 'image/png' });
});

test('returns 400 for malformed and unsupported body formats', async () => {
  const malformed = await bodyApp().fetch(new Request('http://localhost/body', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{',
  }));
  expect(malformed.status).toBe(400);

  const unsupported = await bodyApp().fetch(new Request('http://localhost/body', {
    method: 'POST',
    headers: { 'content-type': 'application/xml' },
    body: '<body />',
  }));
  expect(unsupported.status).toBe(400);
});

test('does not attempt to read a request body more than once', async () => {
  const app = bodyApp();
  const request = new Request('http://localhost/body', {
    method: 'POST',
    headers: { 'content-type': 'text/plain' },
    body: 'once',
  });

  const response = await app.fetch(request);
  expect(await response.text()).toBe('once');
  expect(request.bodyUsed).toBe(true);
});
