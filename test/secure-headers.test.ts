import { expect, test } from 'vitest';
import { createApp, secureHeaders } from '../src/index.js';

test('adds default secure response headers', async () => {
  const app = createApp();
  app.use(secureHeaders());
  app.get('/', {}, async () => ({ status: 200, body: 'ok' }));

  const response = await app.fetch(new Request('http://localhost/'));

  expect(response.headers.get('x-content-type-options')).toBe('nosniff');
  expect(response.headers.get('x-frame-options')).toBe('DENY');
  expect(response.headers.get('referrer-policy')).toBe('no-referrer');
});

test('supports optional policy headers', async () => {
  const app = createApp();
  app.use(secureHeaders({
    contentSecurityPolicy: "default-src 'self'",
    strictTransportSecurity: 'max-age=31536000; includeSubDomains',
  }));
  app.get('/', {}, async () => ({ status: 200, body: 'ok' }));

  const response = await app.fetch(new Request('http://localhost/'));

  expect(response.headers.get('content-security-policy')).toBe(
    "default-src 'self'",
  );
  expect(response.headers.get('strict-transport-security')).toBe(
    'max-age=31536000; includeSubDomains',
  );
});

test('does not overwrite headers set by the route', async () => {
  const app = createApp();
  app.use(secureHeaders());
  app.get('/', {}, async () => ({
    status: 200,
    body: 'ok',
    headers: { 'x-frame-options': 'SAMEORIGIN' },
  }));

  const response = await app.fetch(new Request('http://localhost/'));

  expect(response.headers.get('x-frame-options')).toBe('SAMEORIGIN');
});
