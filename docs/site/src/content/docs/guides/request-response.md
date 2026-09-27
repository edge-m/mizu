---
title: Request and response
description: Work with query strings, headers, bodies, and response helpers.
---

## Read request data

The handler context exposes validated request values when a contract is provided. The raw request and URL are available through `ctx`:

```ts
app.get('/search', {}, async ({ ctx }) => {
  const query = ctx.url.searchParams.get('q');
  const userAgent = ctx.request.headers.get('user-agent');

  return ctx.json({ query, userAgent });
});
```

## Parse a body

Use `extractBody` to parse supported content types according to the request's `content-type` header:

```ts
import { createApp, extractBody } from 'mizu';

const app = createApp();

app.post('/echo', {}, async ({ ctx }) => {
  const body = await extractBody(ctx.request);
  return ctx.json({ body });
});
```

JSON, text, URL-encoded forms, multipart forms, byte arrays, blobs, and PDF requests are supported. Unsupported content types produce a body parsing error.

## Return JSON, text, or an empty response

```ts
app.get('/json', {}, async ({ ctx }) => ctx.json({ ok: true }));
app.get('/text', {}, async ({ ctx }) => ctx.text('ok'));
app.delete('/resource/:id', {}, async ({ ctx }) => ctx.empty());
```

You can also return a response object directly:

```ts
app.get('/created', {}, async () => ({
  status: 201,
  body: { created: true },
  headers: { 'cache-control': 'no-store' },
}));
```

## Headers and streaming

`ctx.header` adds a response header without requiring a separate response object:

```ts
app.get('/version', {}, async ({ ctx }) => {
  ctx.header('x-api-version', '1');
  return ctx.json({ version: 1 });
});
```

For streaming responses, pass a `ReadableStream` to `ctx.stream`.
