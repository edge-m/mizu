import { expect, test } from 'vitest';
import { cors, createApp } from '../src/index.js';

test('adds CORS headers to an allowed origin', async () => {
  const app = createApp();
  app.use(cors({ origin: 'https://app.example' }));
  app.get('/', {}, async () => ({ status: 200, body: 'ok' }));

  const response = await app.fetch(
    new Request('http://localhost/', {
      headers: { origin: 'https://app.example' },
    }),
  );

  expect(response.status).toBe(200);
  expect(response.headers.get('access-control-allow-origin')).toBe(
    'https://app.example',
  );
  expect(response.headers.get('vary')).toBe('Origin');
});

test('answers a CORS preflight without requiring a route', async () => {
  const app = createApp();
  app.use(cors({
    origin: 'https://app.example',
    allowMethods: ['GET', 'POST'],
    allowHeaders: ['Content-Type', 'X-Request-Id'],
    maxAge: 600,
  }));

  const response = await app.fetch(
    new Request('http://localhost/missing', {
      method: 'OPTIONS',
      headers: {
        origin: 'https://app.example',
        'access-control-request-method': 'POST',
        'access-control-request-headers': 'Content-Type, X-Request-Id',
      },
    }),
  );

  expect(response.status).toBe(204);
  expect(response.headers.get('access-control-allow-methods')).toBe('GET, POST');
  expect(response.headers.get('access-control-allow-headers')).toBe(
    'Content-Type, X-Request-Id',
  );
  expect(response.headers.get('access-control-max-age')).toBe('600');
});

test('does not expose CORS headers to a disallowed origin', async () => {
  const app = createApp();
  app.use(cors({ origin: ['https://trusted.example'] }));
  app.get('/', {}, async () => ({ status: 200, body: 'ok' }));

  const response = await app.fetch(
    new Request('http://localhost/', {
      headers: { origin: 'https://evil.example' },
    }),
  );

  expect(response.status).toBe(200);
  expect(response.headers.has('access-control-allow-origin')).toBe(false);
});

test('echoes the request origin when credentials are enabled', async () => {
  const app = createApp();
  app.use(cors({ credentials: true }));
  app.get('/', {}, async () => ({ status: 200, body: 'ok' }));

  const response = await app.fetch(
    new Request('http://localhost/', {
      headers: { origin: 'https://app.example' },
    }),
  );

  expect(response.headers.get('access-control-allow-origin')).toBe(
    'https://app.example',
  );
  expect(response.headers.get('access-control-allow-credentials')).toBe('true');
});
