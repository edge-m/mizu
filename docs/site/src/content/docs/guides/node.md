---
title: Node.js adapter
description: Run a Mizu application on Node.js HTTP.
---

Mizu keeps its core on the Fetch API boundary. The separate `mizu-node` package adapts Node.js `http` requests and responses to that boundary.

## Install

```sh
npm install mizu mizu-node
```

## Start a server

```ts
import { createApp } from 'mizu';
import { createNodeServer } from 'mizu-node';

const app = createApp();

app.get('/health', {}, async () => ({
  status: 200,
  body: { ok: true },
}));

createNodeServer(app).listen(3000);
```

## Configure timeouts

The adapter accepts Node.js server timeout options:

```ts
createNodeServer(app, {
  requestTimeout: 30_000,
  keepAliveTimeout: 5_000,
  headersTimeout: 10_000,
}).listen(3000);
```

## Runtime-neutral deployment

If the target runtime already provides a Fetch-compatible entry point, do not use the Node adapter. Export the app through `createWorkerHandler`:

```ts
import { createApp, createWorkerHandler } from 'mizu';

const app = createApp();
const handler = createWorkerHandler(app);

export default { fetch: handler };
```

This keeps the application and its tests independent from the server process.
