---
title: Routing
description: Define routes, parameters, routers, and route groups.
---

## Define a route

Use an HTTP method, a path, a contract, and an async handler:

```ts
import { createApp } from 'mizu';

const app = createApp();

app.get('/hello', {}, async ({ ctx }) => {
  return ctx.text('Hello, Mizu!');
});
```

Handlers are async-only. A handler can return a response object or use the request context helpers such as `ctx.text`, `ctx.json`, and `ctx.empty`.

## Path parameters

Named segments are available on the handler context:

```ts
app.get('/users/:id', {}, async ({ params, ctx }) => {
  return ctx.json({ id: params.id });
});
```

Wildcard routes use `*` as the final segment:

```ts
app.get('/assets/*', {}, async ({ params, ctx }) => {
  return ctx.text(`Requested: ${params['*']}`);
});
```

Static routes take precedence over parameter and wildcard routes when paths overlap.

## HTTP methods

Mizu provides `get`, `post`, `put`, `patch`, `delete`, `head`, `options`, and `query` methods. The route contract is generic, so request and response schemas can be added without changing the routing API.

```ts
app.post('/users', {}, async ({ body, ctx }) => {
  return ctx.json({ created: body }, 201);
});
```

## Routers and prefixes

Use `createRouter` to group related routes, then mount the router on an application:

```ts
import { createApp, createRouter } from 'mizu';

const users = createRouter();
users.get('/:id', {}, async ({ params, ctx }) => {
  return ctx.json({ id: params.id });
});

const app = createApp();
app.route('/users', users);
```

This keeps feature routes separate while preserving the same handler and middleware model.
