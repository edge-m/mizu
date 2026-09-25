import { expect, test, vi } from 'vitest';
import { request as nodeRequest } from 'node:http';
import { z } from 'zod';
import {
  createApp,
  createNodeServer,
  createRouter,
  createWorkerHandler,
} from '../src/index.js';

const healthRequest = {
  headers: z.object({
    authorization: z.string(),
  }),
};

const healthResponse = {
  200: z.object({
    ok: z.boolean(),
  }),
};

test('serves a typed GET route through the Web Standard fetch API', async () => {
  const app = createApp();

  app.get(
    '/health',
    {
      request: healthRequest,
      response: healthResponse,
    },
    async ({ headers }) => {
      expect(headers.authorization).toBe('Bearer test');

      return {
        status: 200,
        body: { ok: true },
      };
    },
  );

  const response = await app.fetch(
    new Request('http://localhost/health', {
      headers: { authorization: 'Bearer test' },
    }),
  );

  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ ok: true });
});

test('returns 400 when a declared header is invalid', async () => {
  const app = createApp();

  app.get(
    '/health',
    {
      request: healthRequest,
      response: healthResponse,
    },
    async () => ({
      status: 200,
      body: { ok: true },
    }),
  );

  const response = await app.fetch(new Request('http://localhost/health'));

  expect(response.status).toBe(400);
  expect(await response.json()).toMatchObject({
    error: 'Bad Request',
    issues: [
      expect.objectContaining({
        message: expect.any(String),
        path: expect.any(Array),
      }),
    ],
  });
});

test('returns 404 when no route matches', async () => {
  const app = createApp();

  const response = await app.fetch(new Request('http://localhost/missing'));

  expect(response.status).toBe(404);
});

test('passes validated path params to a dynamic GET route', async () => {
  const app = createApp();

  app.get(
    '/todos/:id',
    {
      request: {
        params: z.object({ id: z.string().regex(/^\d+$/) }),
      },
      response: {
        200: z.object({ id: z.string() }),
      },
    },
    async ({ params }) => ({
      status: 200,
      body: { id: params.id },
    }),
  );

  const response = await app.fetch(
    new Request('http://localhost/todos/1'),
  );

  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ id: '1' });
});

test('returns 400 when path params fail validation', async () => {
  const app = createApp();

  app.get(
    '/todos/:id',
    {
      request: {
        params: z.object({ id: z.string().regex(/^\d+$/) }),
      },
    },
    async () => ({ status: 200, body: { ok: true } }),
  );

  const response = await app.fetch(
    new Request('http://localhost/todos/not-a-number'),
  );

  expect(response.status).toBe(400);
});

test('prefers a static route over a dynamic route', async () => {
  const app = createApp();

  app.get('/todos/:id', {}, async () => ({
    status: 200,
    body: { route: 'dynamic' },
  }));
  app.get('/todos/new', {}, async () => ({
    status: 200,
    body: { route: 'static' },
  }));

  const response = await app.fetch(
    new Request('http://localhost/todos/new'),
  );

  expect(await response.json()).toEqual({ route: 'static' });
});

test('dispatches routes without sorting candidates on each request', async () => {
  const app = createApp();
  app.get('/health', {}, async () => ({ status: 200, body: { ok: true } }));
  app.get('/todos/:id', {}, async () => ({ status: 200, body: { ok: true } }));

  const sort = vi.spyOn(Array.prototype, 'sort');
  try {
    const response = await app.fetch(
      new Request('http://localhost/health'),
    );

    expect(response.status).toBe(200);
    expect(sort).not.toHaveBeenCalled();
  } finally {
    sort.mockRestore();
  }
});

test('passes validated query values including repeated parameters', async () => {
  const app = createApp();

  app.get(
    '/todos',
    {
      request: {
        query: z.object({
          completed: z.coerce.boolean().optional(),
          limit: z.coerce.number().default(10),
          tag: z.array(z.string()).optional(),
        }),
      },
      response: {
        200: z.object({
          completed: z.boolean().optional(),
          limit: z.number(),
          tag: z.array(z.string()),
        }),
      },
    },
    async ({ query }) => ({
      status: 200,
      body: {
        completed: query.completed,
        limit: query.limit,
        tag: query.tag ?? [],
      },
    }),
  );

  const response = await app.fetch(
    new Request('http://localhost/todos?completed=true&tag=work&tag=urgent'),
  );

  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({
    completed: true,
    limit: 10,
    tag: ['work', 'urgent'],
  });
});

test('returns 400 when query values fail validation', async () => {
  const app = createApp();

  app.get(
    '/todos',
    {
      request: {
        query: z.object({ completed: z.enum(['true', 'false']) }),
      },
    },
    async () => ({ status: 200, body: { ok: true } }),
  );

  const response = await app.fetch(
    new Request('http://localhost/todos?completed=not-a-boolean'),
  );

  expect(response.status).toBe(400);
});

test('serves a typed POST route with a validated JSON body', async () => {
  const app = createApp();

  app.post(
    '/todos',
    {
      request: {
        body: z.object({ title: z.string().trim().min(1) }),
      },
      response: {
        201: z.object({ title: z.string() }),
      },
    },
    async ({ body }) => ({
      status: 201,
      body: { title: body.title },
    }),
  );

  const response = await app.fetch(
    new Request('http://localhost/todos', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: '  Write tests  ' }),
    }),
  );

  expect(response.status).toBe(201);
  expect(await response.json()).toEqual({ title: 'Write tests' });
});

test('returns 400 for malformed JSON request bodies', async () => {
  const app = createApp();

  app.post(
    '/todos',
    { request: { body: z.object({ title: z.string() }) } },
    async () => ({ status: 201, body: { ok: true } }),
  );

  const response = await app.fetch(
    new Request('http://localhost/todos', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{"title":',
    }),
  );

  expect(response.status).toBe(400);
});

test('does not read a GET request body', async () => {
  const app = createApp();
  let bodyRead = false;

  app.get('/health', {}, async () => ({
    status: 200,
    body: { ok: true },
  }));

  const request = {
    method: 'GET',
    url: 'http://localhost/health',
    headers: new Headers(),
    json: async () => {
      bodyRead = true;
      throw new Error('GET body should not be read');
    },
  } as unknown as Request;

  const response = await app.fetch(request);

  expect(response.status).toBe(200);
  expect(bodyRead).toBe(false);
});

test('returns 500 when the handler status has no response schema', async () => {
  const app = createApp();

  app.get(
    '/todos',
    { response: { 200: z.object({ ok: z.boolean() }) } },
    async () => ({ status: 201, body: { ok: true } }),
  );

  const response = await app.fetch(new Request('http://localhost/todos'));

  expect(response.status).toBe(500);
});

test('returns 500 when the response body fails its status schema', async () => {
  const app = createApp();

  app.get(
    '/todos',
    { response: { 200: z.object({ ok: z.boolean() }) } },
    async () => ({
      status: 200,
      body: { ok: 'yes' } as unknown as { ok: boolean },
    }),
  );

  const response = await app.fetch(new Request('http://localhost/todos'));

  expect(response.status).toBe(500);
  expect(await response.json()).toEqual({ error: 'Internal Server Error' });
});

test('does not expose thrown handler errors in the error response', async () => {
  const app = createApp();

  app.get('/failure', {}, async () => {
    throw new Error('database password=secret');
  });

  const response = await app.fetch(new Request('http://localhost/failure'));

  expect(response.status).toBe(500);
  expect(await response.json()).toEqual({ error: 'Internal Server Error' });
});

test('supports non-JSON response bodies and response headers', async () => {
  const app = createApp();

  app.get(
    '/text',
    { response: { 200: z.string() } },
    async () => ({
      status: 200,
      body: 'created',
      headers: { 'content-type': 'text/plain', 'x-request-id': 'test-1' },
    }),
  );

  const response = await app.fetch(new Request('http://localhost/text'));

  expect(response.status).toBe(200);
  expect(await response.text()).toBe('created');
  expect(response.headers.get('content-type')).toBe('text/plain');
  expect(response.headers.get('x-request-id')).toBe('test-1');
});

test('supports empty responses with a status and headers', async () => {
  const app = createApp();

  app.get(
    '/health',
    { response: { 204: z.undefined() } },
    async () => ({
      status: 204,
      body: undefined,
      headers: { 'x-health': 'ok' },
    }),
  );

  const response = await app.fetch(new Request('http://localhost/health'));

  expect(response.status).toBe(204);
  expect(await response.text()).toBe('');
  expect(response.headers.get('x-health')).toBe('ok');
});

test('runs app middleware in registration order around the route', async () => {
  const app = createApp();
  const events: string[] = [];

  app.use(async (request, next) => {
    events.push(`before:${request.method}`);
    const response = await next();
    events.push(`after:${response.status}`);
    return response;
  });
  app.use(async (_request, next) => {
    events.push('inner-before');
    const response = await next();
    events.push('inner-after');
    return response;
  });
  app.get('/health', {}, async () => {
    events.push('handler');
    return { status: 200, body: { ok: true } };
  });

  const response = await app.fetch(new Request('http://localhost/health'));

  expect(response.status).toBe(200);
  expect(events).toEqual([
    'before:GET',
    'inner-before',
    'handler',
    'inner-after',
    'after:200',
  ]);
});

test('allows middleware to short-circuit a request', async () => {
  const app = createApp();
  let handlerCalled = false;

  app.use(async () => new Response('blocked', { status: 401 }));
  app.get('/health', {}, async () => {
    handlerCalled = true;
    return { status: 200, body: { ok: true } };
  });

  const response = await app.fetch(new Request('http://localhost/health'));

  expect(response.status).toBe(401);
  expect(await response.text()).toBe('blocked');
  expect(handlerCalled).toBe(false);
});

test('allows middleware to replace the downstream response', async () => {
  const app = createApp();

  app.use(async (_request, next) => {
    const response = await next();
    return new Response(response.body, {
      status: response.status,
      headers: { ...Object.fromEntries(response.headers), 'x-middleware': 'yes' },
    });
  });
  app.get('/health', {}, async () => ({
    status: 200,
    body: { ok: true },
  }));

  const response = await app.fetch(new Request('http://localhost/health'));

  expect(response.headers.get('x-middleware')).toBe('yes');
  expect(await response.json()).toEqual({ ok: true });
});

test('composes router paths under an app prefix', async () => {
  const app = createApp();
  const todos = createRouter();

  todos.get(
    '/:id',
    {
      request: { params: z.object({ id: z.string() }) },
      response: { 200: z.object({ id: z.string() }) },
    },
    async ({ params }) => ({ status: 200, body: { id: params.id } }),
  );
  app.route('/todos', todos);

  const response = await app.fetch(
    new Request('http://localhost/todos/42'),
  );

  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ id: '42' });
});

test('applies router middleware only to composed routes', async () => {
  const app = createApp();
  const todos = createRouter();
  const events: string[] = [];

  todos.use(async (_request, next) => {
    events.push('group-before');
    const response = await next();
    events.push('group-after');
    return response;
  });
  todos.get('/list', {}, async () => {
    events.push('todos-handler');
    return { status: 200, body: { route: 'todos' } };
  });
  app.get('/health', {}, async () => {
    events.push('health-handler');
    return { status: 200, body: { route: 'health' } };
  });
  app.route('/todos', todos);

  await app.fetch(new Request('http://localhost/health'));
  await app.fetch(new Request('http://localhost/todos/list'));

  expect(events).toEqual([
    'health-handler',
    'group-before',
    'todos-handler',
    'group-after',
  ]);
});

test.each([
  ['PUT', 'put'],
  ['PATCH', 'patch'],
  ['DELETE', 'delete'],
] as const)('serves a %s route with a validated JSON body', async (method, registration) => {
  const app = createApp();
  const register = app[registration].bind(app);

  register(
    '/todos/:id',
    {
      request: {
        params: z.object({ id: z.string() }),
        body: z.object({ completed: z.boolean() }),
      },
      response: {
        200: z.object({ id: z.string(), completed: z.boolean() }),
      },
    },
    async ({ params, body }) => ({
      status: 200,
      body: { id: params.id, completed: body.completed },
    }),
  );

  const response = await app.fetch(
    new Request('http://localhost/todos/1', {
      method,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ completed: true }),
    }),
  );

  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ id: '1', completed: true });
});

test('supports PUT, PATCH, and DELETE routes in a composed router', async () => {
  const app = createApp();
  const router = createRouter();

  router.put('/put', {}, async () => ({ status: 200, body: { method: 'put' } }));
  router.patch('/patch', {}, async () => ({ status: 200, body: { method: 'patch' } }));
  router.delete('/delete', {}, async () => ({ status: 200, body: { method: 'delete' } }));
  app.route('/items', router);

  for (const method of ['PUT', 'PATCH', 'DELETE']) {
    const response = await app.fetch(
      new Request(`http://localhost/items/${method.toLowerCase()}`, { method }),
    );

    expect(response.status).toBe(200);
    expect((await response.json()).method).toBe(method.toLowerCase());
  }
});

test('passes validated query values to non-GET routes', async () => {
  const app = createApp();

  app.patch(
    '/todos/:id',
    {
      request: {
        params: z.object({ id: z.string() }),
        query: z.object({ notify: z.coerce.boolean().default(false) }),
      },
      response: { 200: z.object({ id: z.string(), notify: z.boolean() }) },
    },
    async ({ params, query }) => ({
      status: 200,
      body: { id: params.id, notify: query.notify },
    }),
  );

  const response = await app.fetch(
    new Request('http://localhost/todos/1?notify=true', { method: 'PATCH' }),
  );

  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ id: '1', notify: true });
});

test('serves the HTTP QUERY method with a JSON query document', async () => {
  const app = createApp();

  app.query(
    '/search',
    {
      request: {
        body: z.object({ term: z.string().min(1) }),
      },
      response: { 200: z.object({ result: z.string() }) },
    },
    async ({ body }) => ({
      status: 200,
      body: { result: `matched:${body.term}` },
    }),
  );

  const response = await app.fetch(
    new Request('http://localhost/search', {
      method: 'QUERY',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ term: 'mizu' }),
    }),
  );

  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ result: 'matched:mizu' });
});

test('supports QUERY routes in a composed router', async () => {
  const app = createApp();
  const router = createRouter();

  router.query(
    '/search',
    { request: { body: z.object({ term: z.string() }) } },
    async ({ body }) => ({ status: 200, body: { term: body.term } }),
  );
  app.route('/api', router);

  const response = await app.fetch(
    new Request('http://localhost/api/search', {
      method: 'QUERY',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ term: 'router' }),
    }),
  );

  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ term: 'router' });
});

test('applies route middleware only to the registered route', async () => {
  const app = createApp();
  const events: string[] = [];
  const routeMiddleware = async (_request: Request, next: () => Promise<Response>) => {
    events.push('route-before');
    const response = await next();
    events.push('route-after');
    return response;
  };

  app.get('/protected', {}, async () => {
    events.push('protected-handler');
    return { status: 200, body: { route: 'protected' } };
  }, routeMiddleware);
  app.get('/public', {}, async () => {
    events.push('public-handler');
    return { status: 200, body: { route: 'public' } };
  });

  await app.fetch(new Request('http://localhost/public'));
  await app.fetch(new Request('http://localhost/protected'));

  expect(events).toEqual([
    'public-handler',
    'route-before',
    'protected-handler',
    'route-after',
  ]);
});

test('serves the same app through the Node.js adapter', async () => {
  const app = createApp();

  app.get(
    '/health',
    {
      request: { headers: healthRequest.headers },
      response: healthResponse,
    },
    async () => ({
      status: 200,
      body: { ok: true },
    }),
  );

  const server = createNodeServer(app).listen(0);
  await new Promise<void>((resolve) => server.once('listening', resolve));

  try {
    const address = server.address();
    if (!address || typeof address === 'string') {
      throw new Error('Server did not expose a TCP address');
    }

    const response = await fetch(`http://127.0.0.1:${address.port}/health`, {
      headers: { authorization: 'Bearer test' },
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
});

test('forwards a Node.js request body to the Web Standard app', async () => {
  const app = createApp();

  app.post(
    '/todos',
    {
      request: { body: z.object({ title: z.string() }) },
      response: { 201: z.object({ title: z.string() }) },
    },
    async ({ body }) => ({ status: 201, body }),
  );

  const server = createNodeServer(app).listen(0);
  await new Promise<void>((resolve) => server.once('listening', resolve));

  try {
    const address = server.address();
    if (!address || typeof address === 'string') {
      throw new Error('Server did not expose a TCP address');
    }

    const response = await fetch(`http://127.0.0.1:${address.port}/todos`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'From Node' }),
    });

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ title: 'From Node' });
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
});

test('streams a Web response body through the Node.js adapter', async () => {
  const app = createApp();

  app.get('/stream', {}, async () => ({
    status: 200,
    body: new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('chunk-1'));
        controller.enqueue(new TextEncoder().encode('chunk-2'));
        controller.close();
      },
    }),
  }));

  const server = createNodeServer(app).listen(0);
  await new Promise<void>((resolve) => server.once('listening', resolve));

  try {
    const address = server.address();
    if (!address || typeof address === 'string') {
      throw new Error('Server did not expose a TCP address');
    }

    const response = await fetch(`http://127.0.0.1:${address.port}/stream`);

    expect(response.status).toBe(200);
    expect(await response.text()).toBe('chunk-1chunk-2');
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
});

test('aborts the Web request when a Node client disconnects', async () => {
  const app = createApp();
  let requestSignal: AbortSignal | undefined;

  app.use(async (request, next) => {
    requestSignal = request.signal;
    return next();
  });
  app.get('/slow', {}, async () => {
    await new Promise((resolve) => setTimeout(resolve, 100));
    return { status: 200, body: { ok: true } };
  });

  const server = createNodeServer(app).listen(0);
  await new Promise<void>((resolve) => server.once('listening', resolve));

  try {
    const address = server.address();
    if (!address || typeof address === 'string') {
      throw new Error('Server did not expose a TCP address');
    }

    const clientRequest = nodeRequest({
      host: '127.0.0.1',
      port: address.port,
      path: '/slow',
    });
    clientRequest.on('error', () => undefined);
    clientRequest.end();
    await new Promise((resolve) => setTimeout(resolve, 5));
    clientRequest.destroy();

    await new Promise((resolve) => setTimeout(resolve, 25));
    expect(requestSignal?.aborted).toBe(true);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
});

test('connects the app to a Fetch-compatible Workers handler', async () => {
  const app = createApp();

  app.get('/health', {}, async () => ({
    status: 200,
    body: { runtime: 'worker' },
  }));

  const fetchHandler = createWorkerHandler(app);
  const response = await fetchHandler(
    new Request('https://worker.example/health'),
  );

  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ runtime: 'worker' });
});
