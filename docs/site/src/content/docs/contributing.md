---
title: Contributing
description: Set up Mizu locally and validate changes.
---

## Development setup

```sh
git clone https://github.com/edge-m/mizu.git
cd mizu
npm install
```

## Verify changes

```sh
npm test
npm run typecheck
npm run build
```

Run focused tests while iterating, then run the full suite before opening a pull request.

## Repository layout

```text
src/                 Core Mizu package
packages/mizu-node/  Node.js adapter
test/                Unit and integration tests
bench/               Microbenchmarks
benchmarks/          Runtime and server comparisons
docs/                Project documentation and this site
```

Documentation changes live under `docs/site/src/content/docs`. Preview the site locally with:

```sh
cd docs/site
npm run dev
```

Build the static site before submitting a documentation change:

```sh
npm run build
```
