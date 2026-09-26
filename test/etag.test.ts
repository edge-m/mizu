import { expect, test } from 'vitest';
import { createApp, etag } from '../src/index.js';

test('adds an ETag generated from the response body', async () => {
  const app = createApp();
  app.use(etag());
  app.get('/', {}, async () => ({ status: 200, body: 'hello' }));

  const response = await app.fetch(new Request('http://localhost/'));

  expect(response.status).toBe(200);
  expect(response.headers.get('etag')).toMatch(/^"[0-9a-f]{64}"$/);
  expect(await response.text()).toBe('hello');
});

test('returns 304 when If-None-Match matches', async () => {
  const app = createApp();
  app.use(etag());
  app.get('/', {}, async () => ({ status: 200, body: 'hello' }));

  const initial = await app.fetch(new Request('http://localhost/'));
  const tag = initial.headers.get('etag');
  const response = await app.fetch(
    new Request('http://localhost/', {
      headers: { 'if-none-match': tag ?? '' },
    }),
  );

  expect(response.status).toBe(304);
  expect(response.headers.get('etag')).toBe(tag);
  expect(await response.text()).toBe('');
});

test('preserves an explicitly configured ETag', async () => {
  const app = createApp();
  app.use(etag());
  app.get('/', {}, async () => ({
    status: 200,
    body: 'hello',
    headers: { etag: '"custom"' },
  }));

  const response = await app.fetch(new Request('http://localhost/'));

  expect(response.headers.get('etag')).toBe('"custom"');
});
