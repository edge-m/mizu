import { expect, test } from 'vitest';
import { createApp, HttpError } from '../src/index.js';

test('converts a thrown HttpError into its public response', async () => {
  const app = createApp();
  app.get('/private', {}, async () => {
    throw new HttpError(401, { error: 'Unauthorized' });
  });

  const response = await app.fetch(new Request('http://localhost/private'));

  expect(response.status).toBe(401);
  expect(await response.json()).toEqual({ error: 'Unauthorized' });
});

test('does not expose unknown error details by default', async () => {
  const app = createApp();
  app.get('/broken', {}, async () => {
    throw new Error('secret stack detail');
  });

  const response = await app.fetch(new Request('http://localhost/broken'));

  expect(response.status).toBe(500);
  expect(await response.json()).toEqual({ error: 'Internal Server Error' });
});

test('uses a custom not-found handler with Context', async () => {
  const app = createApp();
  app.notFound(async (ctx) => ctx.text(`missing ${ctx.url.pathname}`, 404));

  const response = await app.fetch(new Request('http://localhost/missing'));

  expect(await response.text()).toBe('missing /missing');
});

test('uses a custom error handler with Context', async () => {
  const app = createApp();
  app.onError(async (error, ctx) => {
    expect(error).toBeInstanceOf(Error);
    return ctx.json({ error: 'safe failure', path: ctx.url.pathname }, 503);
  });
  app.get('/broken', {}, async () => {
    throw new Error('secret stack detail');
  });

  const response = await app.fetch(new Request('http://localhost/broken'));

  expect(response.status).toBe(503);
  expect(await response.json()).toEqual({
    error: 'safe failure',
    path: '/broken',
  });
});
