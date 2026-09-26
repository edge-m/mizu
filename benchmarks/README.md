# Mizu / Hono benchmarks

These benchmarks adapt Hono's current official benchmark layout at commit `90d02fb1645c12a65d27f39594d2129db2065ba7`:

- [`fetch/`](./fetch/) measures direct `app.fetch(Request)` overhead with `mitata`, without network I/O.
- [`http-server/`](./http-server/) starts real Node.js servers and measures them with `bombardier` at the same concurrency and duration for both frameworks.

The benchmark apps deliberately use equivalent handlers and payloads. The Mizu Node adapter and Hono's official `@hono/node-server` are both included in the HTTP measurement because they are the runtime adapters used by each framework; this means HTTP results include adapter overhead and should not be read as router-only results.

## Commands

```sh
npm install
npm run bench:environment
node --import tsx benchmarks/fetch/smoke.mts
npm run bench:fetch:compare
go install github.com/codesenberg/bombardier@latest
PATH="$(go env GOPATH)/bin:$PATH" npm run bench:http
```

Fetch comparison defaults to 3 fresh-process rounds. HTTP comparison defaults to 3 runs of 10 seconds per endpoint and concurrency 500; use `--runs`, `--duration`, and `--concurrency` to control the cost. Set `BOMBARDIER` to an explicit binary path when needed.

## Results

The recorded machine-local run is in [`results/2026-09-26-node22.md`](./results/2026-09-26-node22.md). It includes raw values, ratios, and stability notes rather than a single winner claim.
