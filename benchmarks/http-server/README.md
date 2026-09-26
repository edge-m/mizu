# HTTP server benchmark

This follows Hono's current `benchmarks/http-server` approach: Node.js servers are started in fresh processes and exercised by `bombardier` at concurrency 500. It measures fixed text, JSON, path/query, multiple routes, middleware, and POST JSON body endpoints.

Install `bombardier` separately, for example:

```sh
go install github.com/codesenberg/bombardier@latest
```

Run three 10-second rounds (override as needed):

```sh
PATH="$(go env GOPATH)/bin:$PATH" npm run bench:http
PATH="$(go env GOPATH)/bin:$PATH" npm run bench:http -- --runs=5 --duration=10 --concurrency=500
```

Set `BOMBARDIER=/path/to/bombardier` when the binary is not on `PATH`.
