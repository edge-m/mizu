import { expect, test } from 'vitest';
import { z } from 'zod';
import * as mizu from '../src/index.js';

test('exposes the public application entry points', () => {
  expect(Object.keys(mizu)).toEqual([
    'createApp',
    'cors',
    'csrf',
    'secureHeaders',
    'bodyLimit',
    'cacheControl',
    'logger',
    'requestId',
    'etag',
    'deleteCookie',
    'getCookie',
    'getCookies',
    'getSignedCookie',
    'setCookie',
    'setSignedCookie',
    'createNodeServer',
    'createRouter',
    'Context',
    'HttpError',
    'extractBody',
    'createWorkerHandler',
    'request',
  ]);
});

test('app.request creates a Fetch Request from URL and init', async () => {
  const app = mizu.createApp();
  app.post('/echo', { request: { body: z.any() } }, async ({ body }) => ({
    status: 200,
    body,
  }));

  const response = await app.request('http://localhost/echo', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ok: true }),
  });

  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ ok: true });
});
