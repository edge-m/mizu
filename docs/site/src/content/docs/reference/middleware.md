---
title: Middleware reference
description: Built-in middleware and their configuration.
---

## `cors(options?)`

Adds CORS response headers and handles CORS preflight requests.

```ts
cors({
  origin: ['https://app.example.com'],
  allowMethods: ['GET', 'POST'],
  allowHeaders: ['content-type'],
  credentials: true,
  maxAge: 600,
});
```

## `csrf(options?)`

Checks unsafe form requests against the request origin. JSON and other non-form content types pass through so APIs can use their own authentication and anti-CSRF strategy.

## `secureHeaders(options?)`

Sets security response headers when they are not already present. Defaults include `x-content-type-options`, `x-frame-options`, and `referrer-policy`.

## `bodyLimit(maxBytes)`

Rejects requests whose declared or streamed body exceeds the configured byte limit. The default error response is `413 Payload Too Large`.

## `requestId(options?)`

Reads a request ID from `x-request-id` by default or generates one with `crypto.randomUUID()`.

```ts
requestId({
  header: 'x-correlation-id',
  generate: () => crypto.randomUUID(),
});
```

## `logger(sink?)`

Logs method, pathname, status, and elapsed time. Pass a custom sink to integrate with your logging system.

## `cacheControl(value)`

Sets a default `cache-control` response header when the handler has not already set one.

## `etag()`

Adds an ETag and responds with `304 Not Modified` when the request's `if-none-match` header matches.
