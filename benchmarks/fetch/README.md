# Fetch benchmark

This is adapted from Hono's current `benchmarks/fetch` benchmark. It measures direct `app.fetch(Request)` calls in Node.js, with no network or HTTP adapter.

Install dependencies from the repository root, then run one framework:

```sh
npm run bench:fetch -- --framework=mizu
npm run bench:fetch -- --framework=hono
```

The comparison runner uses fresh processes, alternates framework order, and reports the median of each case across rounds:

```sh
BENCH_ROUNDS=5 npm run bench:fetch:compare
BENCH_CASE='path/query' BENCH_ROUNDS=5 npm run bench:fetch:compare
```

The cases are fixed text, JSON response, path/query access, multiple registered routes, JSON body parsing, and one no-op middleware.
