---
title: API reference
description: Overview of the public Mizu API.
---

## Application

### `createApp()`

Creates an application with route registration, middleware, error handling, and a Fetch-compatible `fetch` method.

```ts
const app = createApp();
```

### `app.request(input, init?)`

Creates a `Request`, sends it through the application, and returns a `Response`. It is useful for unit and integration tests.

### `app.fetch(request)`

The runtime-neutral application boundary.

### Route methods

`get`, `post`, `put`, `patch`, `delete`, `head`, `options`, and `query` accept a path, contract, handler, and optional route middleware.

### `app.use(middleware)`

Registers application-wide middleware. A path can be supplied to scope middleware to a route prefix.

### `app.route(prefix, router)`

Mounts a router under a path prefix.

### `app.onError(handler)`

Replaces the default error handler.

### `app.notFound(handler)`

Replaces the default 404 handler.

## Factories and helpers

| API | Purpose |
| --- | --- |
| `createRouter` | Build a reusable group of routes |
| `createWorkerHandler` | Expose an app as a Fetch-style worker handler |
| `request` | Send a Request through an app in tests |
| `extractBody` | Parse a supported request body |
| `HttpError` | Return a controlled HTTP error |

## Context

Handlers receive a context through `{ ctx }`. See [Context](./context/) for request data and response helpers.
