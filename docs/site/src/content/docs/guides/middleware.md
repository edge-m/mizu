---
title: Middleware
description: Compose request processing, security, and operational behavior.
---

Middleware receives the current request and a `next` function. It can inspect or replace the request, call the next handler, and modify the response.

```ts
import { createApp, logger, requestId, secureHeaders } from 'mizu';

const app = createApp();

app.use(logger());
app.use(requestId());
app.use(secureHeaders());
```

## Custom middleware

```ts
app.use(async (request, next) => {
  const response = await next();
  response.headers.set('x-powered-by', 'mizu');
  return response;
});
```

Middleware can be scoped to one route:

```ts
app.get('/admin', {}, handler, requireAdmin);
```

## Built-in middleware

Mizu exports small middleware functions for common concerns:

- `cors` — configure cross-origin requests.
- `csrf` — protect unsafe form requests by origin.
- `secureHeaders` — add common security response headers.
- `bodyLimit` — reject request bodies larger than a byte limit.
- `requestId` — preserve or generate a request ID.
- `logger` — log method, path, status, and duration.
- `cacheControl` — set a default `cache-control` header.
- `etag` — add conditional response caching.

Example production baseline:

```ts
import {
  bodyLimit,
  cors,
  createApp,
  logger,
  requestId,
  secureHeaders,
} from 'mizu';

const app = createApp();

app.use(logger());
app.use(requestId());
app.use(bodyLimit(1024 * 1024));
app.use(cors({ origin: 'https://example.com' }));
app.use(secureHeaders());
```

Middleware is executed in registration order. Keep authentication and authorization close to the routes they protect, or register them on a router for a feature-wide boundary.
