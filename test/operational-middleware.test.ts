import { expect, test } from 'vitest';
import { cacheControl, createApp, logger, requestId } from '../src/index.js';

test('logs method, path, status, and duration after a response', async () => {
  const messages: string[] = [];
  const app = createApp();
  app.use(logger((message) => messages.push(message)));
  app.get('/health', {}, async () => ({ status: 200, body: 'ok' }));

  await app.fetch(new Request('http://localhost/health'));

  expect(messages).toHaveLength(1);
  expect(messages[0]).toMatch(/^GET \/health 200 \d+ms$/);
});

test('returns the incoming request ID', async () => {
  const app = createApp();
  app.use(requestId());
  app.get('/', {}, async () => ({ status: 200, body: 'ok' }));

  const response = await app.fetch(
    new Request('http://localhost/', {
      headers: { 'x-request-id': 'req-123' },
    }),
  );

  expect(response.headers.get('x-request-id')).toBe('req-123');
});

test('generates a request ID when one is not provided', async () => {
  const app = createApp();
  app.use(requestId({ generate: () => 'generated-123' }));
  app.get('/', {}, async () => ({ status: 200, body: 'ok' }));

  const response = await app.fetch(new Request('http://localhost/'));

  expect(response.headers.get('x-request-id')).toBe('generated-123');
});

test('does not overwrite a request ID set by the route', async () => {
  const app = createApp();
  app.use(requestId({ generate: () => 'middleware-id' }));
  app.get('/', {}, async () => ({
    status: 200,
    body: 'ok',
    headers: { 'x-request-id': 'route-id' },
  }));

  const response = await app.fetch(new Request('http://localhost/'));

  expect(response.headers.get('x-request-id')).toBe('route-id');
});

test('adds cache-control without overwriting a route policy', async () => {
  const app = createApp();
  app.use(cacheControl('public, max-age=60'));
  app.get('/default', {}, async () => ({ status: 200, body: 'ok' }));
  app.get('/custom', {}, async () => ({
    status: 200,
    body: 'ok',
    headers: { 'cache-control': 'no-store' },
  }));

  const defaultResponse = await app.fetch(
    new Request('http://localhost/default'),
  );
  const customResponse = await app.fetch(
    new Request('http://localhost/custom'),
  );

  expect(defaultResponse.headers.get('cache-control')).toBe(
    'public, max-age=60',
  );
  expect(customResponse.headers.get('cache-control')).toBe('no-store');
});

test('runs path-aware middleware and exposes route metadata', async () => {
  const app = createApp();

  app.use('/admin', async (_request, next, context) => {
    context?.set('scope', 'admin');
    return next();
  });
  app.get('/admin/users/:id', {}, async ({ ctx }) => ({
    status: 200,
    body: {
      scope: ctx.get('scope'),
      route: ctx.routePath,
      base: ctx.basePath,
    },
  }));

  const matched = await app.fetch(new Request('http://localhost/admin/users/1'));
  expect(await matched.json()).toEqual({
    scope: 'admin',
    route: '/admin/users/:id',
    base: '/',
  });

  const skipped = await app.fetch(new Request('http://localhost/public'));
  expect(skipped.status).toBe(404);
});
