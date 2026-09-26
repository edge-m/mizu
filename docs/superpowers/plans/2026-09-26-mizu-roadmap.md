# mizu Roadmap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** mizuの契約中心設計を維持しながら、Honoとの差分として必要なHTTP境界・DX・拡張境界を段階的に実装する。

**Architecture:** Fetch CoreにContext、response helper、error hook、body extractor、route metadataを追加する。WebSocket、OpenAPI、RPC実行client、追加runtimeはCoreから分離し、adapterまたは別packageとして接続する。

**Tech Stack:** TypeScript、Fetch API、Standard Schema、Vitest、Node.js 22+、既存の`mizu-node` workspace package。

**Spec:** `docs/mizu-roadmap-review.md`

## Global Constraints

- CoreはWeb標準APIを使い、Node.js固有型を公開しない。
- Standard Schemaを別schema形式へ変換しない。
- `path → contract → handler`をHTTP契約の正とする。
- decorator、DI container、class-based DTO、ORMをCoreへ追加しない。
- 既存benchmarkとasync-only公開APIを維持する。

## Review Focus

- bodyの二重読み取り: JSON以外のextractor追加後もbodyは一度だけ読めることをテストする。
- 405と`Allow`: pathは一致するがmethodがない場合に404と混同しないことをテストする。
- middlewareの型情報: `set/get`した値がhandlerまで安全に渡ることを型テストする。
- error情報漏えい: custom error handler未設定時に内部stackやsecretを公開しないことをテストする。
- adapter境界: streamingのcancelとclient disconnectがCoreの公開型を汚染しないことをadapter testで確認する。

## File Map

- Modify: `src/types.ts` — Context、response helper、error hook、route metadataの公開型。
- Modify: `src/app.ts` — dispatch、middleware、body extraction、error handling、metadata接続。
- Create: `src/context.ts` — request contextとrequest/response helperの実装。
- Create: `src/errors.ts` — HTTP errorの公開型と既定変換。
- Create: `src/body.ts` — content typeごとのbody extraction。
- Modify: `src/index.ts` —公開APIのexport。
- Modify: `test/app.test.ts`、`test/types.test.ts` — Coreの回帰・型テスト。
- Create: `test/context.test.ts`、`test/body.test.ts`、`test/error-handling.test.ts` — 新機能のテスト。
- Modify: `packages/mizu-node/src/server.ts` — streaming / disconnect境界が必要になった場合のみ。

## Task 1: HTTP method completeness

**Files:**
- Modify: `src/app.ts`
- Modify: `src/types.ts`
- Test: `test/app.test.ts`

**Interfaces:**
- Produces: method未対応時の405 responseと`Allow` header、HEAD / OPTIONSの明示的な挙動。

- [ ] Write failing tests for 405、`Allow`、HEAD、OPTIONS。
- [ ] Run `npm test -- --run test/app.test.ts` and confirm failure.
- [ ] Implement method resolution without changing static/dynamic route precedence.
- [ ] Run the focused tests and `npm test`.
- [ ] Commit with `feat: complete HTTP method dispatch`.

## Task 2: Context and response helpers

**Files:**
- Create: `src/context.ts`
- Modify: `src/types.ts`
- Modify: `src/app.ts`
- Modify: `src/index.ts`
- Test: `test/context.test.ts`
- Test: `test/types.test.ts`

**Interfaces:**
- Produces: `Context`、`text()`、`json()`、`empty()`、`stream()`、header操作、typed `set/get`の最小API。

- [ ] Define tests proving raw Request access, response headers, text/json/empty response, and stream response.
- [ ] Add compile-time tests proving contract input remains distinct from Context data.
- [ ] Implement Context construction only after route match and only for the selected request.
- [ ] Preserve the existing `{ status, body }` handler contract for compatibility.
- [ ] Run `npm test` and `npm run typecheck`.
- [ ] Commit with `feat: add HTTP context and response helpers`.

## Task 3: Configurable error handling

**Files:**
- Create: `src/errors.ts`
- Modify: `src/app.ts`
- Modify: `src/types.ts`
- Modify: `src/index.ts`
- Test: `test/error-handling.test.ts`

**Interfaces:**
- Produces: `HttpError`、`app.onError()`、`app.notFound()`、既定の非露出error response。

- [ ] Add tests for thrown `HttpError`, unknown thrown error, custom not-found response, and custom error response.
- [ ] Run focused tests and confirm failure.
- [ ] Implement hooks around existing validation, dispatch, and handler error boundaries.
- [ ] Ensure custom handlers receive Context but do not bypass response validation for normal route returns.
- [ ] Run `npm test` and `npm run typecheck`.
- [ ] Commit with `feat: add configurable error handling`.

## Task 4: Non-JSON body extraction

**Files:**
- Create: `src/body.ts`
- Modify: `src/app.ts`
- Modify: `src/types.ts`
- Modify: `src/index.ts`
- Test: `test/body.test.ts`

**Interfaces:**
- Produces: content type-aware extraction for text、formData、arrayBuffer、blob、urlencoded、multipart。

- [ ] Add tests for each supported content type, malformed input, unsupported content type, and double-read prevention.
- [ ] Run focused tests and confirm failure.
- [ ] Implement one-shot extraction and connect extracted values to existing Standard Schema validation.
- [ ] Apply existing body size limits before parsing where the runtime makes this possible.
- [ ] Run `npm test`, `npm run typecheck`, and the body benchmark.
- [ ] Commit with `feat: support standard request body formats`.

## Task 5: Path-aware middleware and route metadata

**Files:**
- Modify: `src/app.ts`
- Modify: `src/types.ts`
- Modify: `src/index.ts`
- Test: `test/operational-middleware.test.ts`
- Test: `test/types.test.ts`

**Interfaces:**
- Produces: `app.use(path, middleware)`、method-aware middleware、current route path、base path、matched route metadata。

- [ ] Add tests for path matching, static-over-wildcard precedence, group composition, and metadata visibility.
- [ ] Run focused tests and confirm failure.
- [ ] Compile middleware matchers at registration time and reuse existing route dispatch metadata.
- [ ] Ensure metadata does not expose handler internals or change contract validation order.
- [ ] Run `npm test`, `npm run typecheck`, and route benchmarks.
- [ ] Commit with `feat: add path-aware middleware and route metadata`.

## Task 6: Testing DX

**Files:**
- Create: `src/testing.ts`
- Modify: `src/index.ts`
- Test: `test/index.test.ts`
- Test: `test/types.test.ts`

**Interfaces:**
- Produces: `app.request(input, init)` or a separately exported testing helper, plus contract-preserving response fixtures.

- [ ] Add tests showing URL, method, headers, and JSON body can be supplied without manually constructing Request.
- [ ] Add type tests to ensure helpers do not widen route response types to `any`.
- [ ] Implement the smallest helper that remains a thin wrapper over `app.fetch`.
- [ ] Evaluate typed client only if route composition preserves inference; otherwise document it as a later separate package.
- [ ] Run all tests and typecheck.
- [ ] Commit with `feat: add fetch testing helpers`.

## Task 7: Extension boundary validation

**Files:**
- Create: `docs/mizu-extension-boundaries.md`
- Modify: `docs/mizu-roadmap-review.md`
- Test: `test/worker.test.ts` or adapter-specific tests if implementation begins.

**Interfaces:**
- Produces: documented contracts for streaming/SSE, WebSocket, OpenAPI, RPC client, and runtime environment adapters.

- [ ] Document which APIs belong to Core, adapter, or separate package.
- [ ] Add a minimal stream response adapter test before adding SSE or WebSocket functionality.
- [ ] Verify Core exports contain no platform-specific types.
- [ ] Do not implement JSX, SSG, GraphQL, OAuth/OIDC, ORM, or DI as part of this roadmap.
- [ ] Run `npm test`, `npm run typecheck`, and `npm run build`.
- [ ] Commit with `docs: define mizu extension boundaries`.

## Verification Checklist

- [ ] `npm test`
- [ ] `npm run typecheck`
- [ ] `npm run build`
- [ ] `npm run bench`
- [ ] Existing route, validation, adapter, cookie, CORS, CSRF, and operational middleware tests remain green.
- [ ] No new Core dependency is introduced solely to imitate a Hono helper.
