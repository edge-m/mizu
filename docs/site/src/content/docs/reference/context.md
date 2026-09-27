---
title: Context
description: Request metadata, variables, and response helpers.
---

The `Context` instance is available as `ctx` in every handler and middleware context.

## Request data

| Property | Description |
| --- | --- |
| `ctx.request` | The incoming Fetch `Request` |
| `ctx.url` | Parsed request URL |
| `ctx.method` | HTTP method |
| `ctx.signal` | Request cancellation signal |
| `ctx.routePath` | Matched route path when available |
| `ctx.basePath` | Mounted router base path when available |

## Response helpers

```ts
ctx.text('hello');
ctx.json({ ok: true });
ctx.empty();
ctx.stream(stream);
```

Each helper accepts an optional status code. `ctx.header(name, value)` adds a response header to the result.

```ts
app.get('/created', {}, async ({ ctx }) => {
  ctx.header('location', '/resources/1');
  return ctx.empty(201);
});
```

## Request-scoped values

Middleware can store values for downstream handlers:

```ts
const auth = async (_request, next, ctx) => {
  ctx?.set('userId', 'user-123');
  return next();
};

app.get('/me', {}, async ({ ctx }) => {
  return ctx.json({ userId: ctx.get('userId') });
}, auth);
```

For shared application types, export a `ContextVariables` declaration that describes the keys your middleware provides.
