---
title: Quickstart
description: Build and run your first Mizu API.
---

## Requirements

- Node.js 22 or later
- TypeScript or a TypeScript-aware runtime such as `tsx`

## Install

```sh
npm install mizu mizu-node
```

The core package is runtime-neutral. `mizu-node` is only needed when the application should listen on a Node.js HTTP server.

## Create an application

```ts
import { createApp } from 'mizu';
import { createNodeServer } from 'mizu-node';

const app = createApp();

app.get('/health', {}, async () => ({
  status: 200,
  body: { ok: true },
}));

createNodeServer(app).listen(3000, () => {
  console.log('Listening on http://localhost:3000');
});
```

Start the server and call the route:

```sh
curl http://localhost:3000/health
```

The handler returns a `ResponseData` object. Mizu converts its `body` into a response and preserves the explicit status and headers.

## Test without opening a port

Every application exposes the Fetch API boundary. This makes request tests small and runtime-independent:

```ts
const response = await app.request('http://localhost/health');

console.log(response.status); // 200
console.log(await response.json()); // { ok: true }
```

For an application that only needs a Fetch-compatible handler, use `app.fetch` directly or wrap it with `createWorkerHandler`.

## Next steps

- Add [routes and parameters](/guides/routing/).
- Parse [request bodies and responses](/guides/request-response/).
- Compose [middleware](/guides/middleware/).
- Configure the [Node.js adapter](/guides/node/).
