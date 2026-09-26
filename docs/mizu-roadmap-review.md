# mizu Roadmap Review

## 目的

この文書は、Honoのような軽量Webフレームワークを目指すうえで候補になる機能を、mizuの設計思想に照らして評価したものである。Honoとの機能数の一致を目的にせず、次の価値を強化する機能だけをmizuのロードマップへ採用する。

- Web標準の`Request` / `Response`を中心にする
- `path → contract → handler`の順にHTTP契約を読める
- Standard Schemaからhandlerの入力・出力型を推論する
- response statusとresponse schemaを同じ契約で扱う
- Coreを薄く保ち、runtime固有機能はadapterへ分離する
- decorator、DI、class-based DTO、ORMを必須にしない

## 判断基準

| 判定 | 意味 |
| --- | --- |
| 採用 | mizu Coreの契約・HTTP・型安全性を直接強化する |
| 条件付き採用 | 需要はあるが、Coreではなくadapterまたは別packageに置く |
| 対象外 | Honoにはあっても、mizuの責務や差別化を薄める |

## 現在の実装状況

実装済みの基盤は、静的・動的route、query / params / headers / JSON bodyの検証、status別response validation、middleware、router composition、PUT / PATCH / DELETE / QUERY、Node adapter、Fetch adapter、Cookie、CORS、CSRF、secure headers、ETag、request ID、body limit、benchmarkである。

したがって、次の課題はroutingの基本機能を増やすことより、HTTP境界と契約の利用体験を完成させることである。

## 機能レビュー

### 1. Context API — 採用

現状のhandlerは検証済み入力を受け、独自の`{ status, body }`を返す。これは契約の明瞭さには優れるが、raw Requestへのアクセス、runtime情報、handler間の値共有、標準的なresponse生成が不足する。

`Context`を契約の代替にせず、HTTP実行時の補助情報として導入する。

採用範囲:

- raw `Request`、URL、method、headers、`AbortSignal`への明示的アクセス
- `set` / `get`によるmiddlewareからhandlerへの値渡し
- `text`、`json`、`empty`、`stream`などのresponse helper
- response headersの追加

contractは引き続き入力・出力の正とし、Contextにすべてを隠さない。

### 2. Error handling — 採用

現在の400 / 404 / 500変換は固定されている。アプリケーションが認証エラー、domain error、production向けエラー形式を選べる`onError`と`notFound`相当のhookが必要である。

採用範囲:

- `app.onError(handler)`
- `app.notFound(handler)`
- 公開用の`HttpError`または同等のerror型
- 内部エラー情報を既定では公開しない方針

validation errorの変換責務は維持し、validationライブラリの挙動は再実装しない。

### 3. JSON以外のbody — 採用

Web APIとして`text`、`formData`、`arrayBuffer`、`blob`、`application/x-www-form-urlencoded`を扱える必要がある。抽出した値は既存のStandard Schema contractへ接続する。

採用範囲:

- content typeごとのbody extractor
- bodyの一度だけの読み取り
- malformed bodyの400変換
- multipartとform-dataのsize制限

### 4. Path-aware middlewareとroute metadata — 採用

middlewareの再利用性、認可、ログ、デバッグに必要である。route contractを変更せず、登録時metadataとして実装する。

採用範囲:

- `app.use(path, middleware)`
- method指定middlewareまたは`app.all`
- route path、base path、matched routeの取得
- static route優先と既存wildcard semanticsの維持

### 5. Testing helper — 採用

`app.fetch(new Request(...))`は十分に標準的だが、毎回のRequest生成を隠す`app.request()`はテストDXを改善する。contractの型推論を維持できる場合に限り、typed test clientを追加する。

採用範囲:

- `app.request(input, init)`
- response status / headers / bodyを検証しやすいfixture helper
- 型情報を壊さない範囲でのtest client

### 6. RPC client — 条件付き採用

サーバーのroute contractとTypeScript clientの型共有はmizuの思想と相性がよい。一方、RPC専用procedure APIをCoreへ持ち込むとHTTP契約が隠れる。

採用条件:

- HTTP routeを正とする
- `typeof app`またはroute contractからclient型を導出する
- status別responseとvalidation結果を保持する
- 実行clientは別packageに置ける設計にする

### 7. Streaming / SSE — 条件付き採用

`ReadableStream`と`AbortSignal`はWeb標準であり、Coreの責務に含められる。SSEのイベント仕様やNodeの接続管理はhelper / adapterへ分離する。

採用範囲:

- Coreはstream responseを返せる
- SSE helperは別module
- client disconnectとcancelをadapterごとに検証

### 8. WebSocket — 条件付き採用

WebSocketはFetchの通常responseモデルと異なり、runtimeごとにupgrade APIが異なる。Core route contractへ直接組み込まず、runtime adapterまたは別packageで提供する。

### 9. OpenAPI — 条件付き採用

契約から仕様を出力する需要はあるが、mizuの設計方針はOpenAPIを正とせず、Standard Schemaを変換・再実装しないことである。まずは外部pluginが利用できるroute metadataとschema introspection境界を整備し、generatorは別packageに置く。

### 10. HTML / JSX / SSG — 対象外

Web標準のtext / HTML response helperまでは採用するが、JSX renderer、SSG、frontend build systemはAPIサーバーCoreの責務を越える。必要なら別packageで統合する。

### 11. 認証middleware — 条件付き採用

Basic、Bearer、JWTの共通部分はmiddlewareとして有用だが、OAuth / OIDC / Firebaseなどのprovider-specific機能は対象外とする。検証済みclaimsを型安全にhandlerへ渡すcontext data APIを先に整備する。

### 12. 多数のruntime adapter — 条件付き採用

Fetch Coreの再利用性を高めるが、Node以外のplatform APIをCoreへ混ぜない。優先順位はNode hardening、Workersの実用化、Bun / Deno、serverless adapterの順とする。

### 13. 対象外

- DI container、decorator、class-based DTO
- ORM、database abstraction
- RPC専用procedure API
- OpenAPI / JSON Schemaを仕様の正にする仕組み
- 他言語SDKの自動生成
- GraphQL server
- JSX、SSG、frontend build system
- OAuth / OIDC provider-specific integration

## ロードマップ

### Phase 6: HTTP境界の完成

対象: Context、response helper、custom error handling、HEAD / OPTIONS / 405、JSON以外のbody、path-aware middleware。

完了条件:

- raw Request / Responseを明示的に扱える
- 405と`Allow`が正しく返る
- body extractorが一度だけbodyを読み、schemaへ接続する
- custom error handlerでproduction向けresponseを選べる
- 既存のcontract型推論と性能baselineを壊さない

### Phase 7: route metadataとTesting DX

対象: route path情報、matched route、`app.request()`、typed test clientの最小設計。

完了条件:

- middleware / handlerから現在のroute情報を取得できる
- test helperがFetch APIの意味を隠しすぎない
- route composition後も型情報が破綻しない

### Phase 8: 契約連携の拡張

対象: RPC clientの設計検証、OpenAPI generatorの別package境界、schema introspectionの最小API。

完了条件:

- HTTP route contractが唯一の正である
- client型がstatus別responseを失わない
- OpenAPI機能をCore依存なしで追加できる

### Phase 9: Streamingとruntime機能

対象: stream response、SSE、Node adapterのWebSocket、Bun / Deno adapter、runtime env helper。

完了条件:

- Core公開型にruntime固有型が混ざらない
- disconnect / cancellation / timeoutをruntimeごとに検証できる
- streamingを通常JSON routeへ強制しない

## 非機能要件

- CoreはWeb標準APIを使い、Node.js固有型を公開しない
- Standard Schemaを別schema形式へ変換しない
- 新機能ごとにunit test、型テスト、必要なadapter testを追加する
- 既存benchmarkを変更前後で実行し、route dispatchとvalidationの回帰を確認する
- 依存追加は、Coreの責務を増やさず機能を明確に分離できる場合に限る
- 破壊的なAPI変更はmigration noteを伴わせる

## 外部比較の位置付け

HonoはContext、middleware、helper、RPC、testing、WebSocket、複数runtime adapterを提供している。これらは不足機能の候補を見つけるために参照するが、採用判断はmizuの契約中心設計を基準にする。

- [Hono公式概要](https://hono.dev/docs)
- [Hono Middleware](https://hono.dev/docs/guides/middleware)
- [Hono RPC](https://hono.dev/docs/guides/rpc)
- [Hono Testing Helper](https://hono.dev/docs/helpers/testing)
- [Hono WebSocket Helper](https://hono.dev/docs/helpers/websocket)

## 判断の要約

最初に実装するべきなのは、Honoの機能数を追うことではなく、**契約を保ったままHTTP境界を扱えるContext / Response / Error APIを完成させること**である。RPC、OpenAPI、WebSocket、JSX、追加runtimeは、その境界が安定した後に別packageまたはadapterとして追加する。
