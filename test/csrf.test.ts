import { expect, test } from 'vitest';
import { createApp, csrf } from '../src/index.js';

function formRequest(
  method: string,
  headers: Record<string, string> = {},
): Request {
  return new Request('https://api.example/transfer', {
    method,
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      ...headers,
    },
    body: method === 'GET' || method === 'HEAD' ? undefined : 'amount=10',
  });
}

test('allows safe methods without CSRF headers', async () => {
  const app = createApp();
  app.use(csrf());
  app.get('/transfer', {}, async () => ({ status: 200, body: 'ok' }));

  const response = await app.fetch(
    new Request('https://api.example/transfer'),
  );

  expect(response.status).toBe(200);
});

test('blocks cross-site form submissions', async () => {
  const app = createApp();
  app.use(csrf());
  app.post('/transfer', {}, async () => ({ status: 200, body: 'ok' }));

  const response = await app.fetch(
    formRequest('POST', {
      origin: 'https://evil.example',
      'sec-fetch-site': 'cross-site',
    }),
  );

  expect(response.status).toBe(403);
  expect(await response.text()).toBe('Forbidden');
});

test('allows same-origin form submissions', async () => {
  const app = createApp();
  app.use(csrf());
  app.post('/transfer', {}, async () => ({ status: 200, body: 'ok' }));

  const response = await app.fetch(
    formRequest('POST', {
      origin: 'https://api.example',
      'sec-fetch-site': 'same-origin',
    }),
  );

  expect(response.status).toBe(200);
});

test('does not block cross-site JSON requests', async () => {
  const app = createApp();
  app.use(csrf());
  app.post('/transfer', {}, async () => ({ status: 200, body: 'ok' }));

  const response = await app.fetch(
    new Request('https://api.example/transfer', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: 'https://evil.example',
        'sec-fetch-site': 'cross-site',
      },
      body: '{}',
    }),
  );

  expect(response.status).toBe(200);
});
