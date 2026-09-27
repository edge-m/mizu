---
title: Architecture
description: Understand the boundaries that make Mizu small and portable.
---

Mizu is organized around a small core and explicit adapters.

## The request boundary

An application is a Fetch-compatible object:

```ts
const response = await app.fetch(request);
```

The same boundary is used by `app.request`, the Node.js adapter, worker-style runtimes, and tests. There is no separate test server or framework-specific request object required.

## Core responsibilities

- **Router:** matches static, parameter, and wildcard paths.
- **Contract validation:** validates request and response data through Standard Schema.
- **Context:** provides URL, headers, variables, and response helpers.
- **Middleware:** composes cross-cutting request behavior.
- **Adapters:** translate a runtime-specific transport into Fetch primitives.

## Package boundaries

The `mizu` package contains the core application, router, context, middleware, cookies, errors, and Fetch-compatible handlers. The `mizu-node` package contains the Node.js HTTP adapter.

Keeping the adapter separate makes the core easier to test and avoids coupling applications to a specific server runtime.

## Async-only handlers

Handlers and middleware are asynchronous by design. This gives every route the same behavior for database calls, streaming, external services, and cancellation through `request.signal`.
