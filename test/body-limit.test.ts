import { expect, test } from 'vitest';
import { bodyLimit, createApp } from '../src/index.js';

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
