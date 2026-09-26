# mizu 実装計画

## 方針

mizuは、細く薄いVertical Sliceを順番に通し、各Sliceが実際に動く状態を維持しながら機能の幅を広げる。

設計の中心は次のとおり。

- Web標準APIを中心にしたCore
- Fetch APIを中心にしたruntime非依存のCore
- Node.js adapterは`mizu-node`として別パッケージで提供
- Cloudflare WorkersなどのFetch runtimeへ展開可能なadapter境界
- Standard Schemaによるruntime validationと型推論
- `path → contract → handler` の宣言順序
- request / responseを同じroute contractで扱う
- OpenAPIやJSON Schemaのような言語間契約は扱わない
- decorator、DI container、class-based DTOを必須にしない

### パッケージ境界

本体の`mizu`はFetch APIを公開するCoreに限定する。Node.js固有のHTTP server変換は`mizu-node`へ分離し、Node.js利用者だけが追加導入する。

```text
mizu       Fetch Core / Workers・Edge runtime向け
mizu-node  Node.js IncomingMessage / ServerResponse adapter
```

Coreのroute matching、validation、middleware、handler実行は共通化する。FetchとNode.jsで異なるrequest / response変換は各パッケージが担当する。

### 非同期実行モデル

handlerとmiddlewareはasync-onlyを基本契約とする。同期handler専用の高速経路は設けず、Promiseを返す実行モデルに統一する。

- handlerは`Promise<ResponseData>`を返す
- middlewareは`Promise<Response>`を返す
- `MaybePromise`は公開APIから削除済み
- 同期処理だけのhandlerも`async`関数として記述する

async-only化の目的は、I/O中心のHTTP処理に実行モデルを合わせ、型・middleware・benchmark条件を単純化することにある。同期関数を許容するためのruntime分岐や`Promise.resolve()`のfallbackは追加しない。

async-only化と`mizu-node`のworkspace package化を実装済み。既存の`mizu`からのNode adapter exportは移行期間の互換層として残す。

## 完了済み

### Slice 0: TypeScriptライブラリ基盤

- Node.js 22+
- ESM / strict TypeScript
- tsup / Vitest / npm
- `src/index.ts` を公開エントリポイントとする構成

### Slice 1: GET + headers + Web標準Core

実装済み。

```ts
const healthRequest = {
  headers: z.object({
    authorization: z.string(),
  }),
};

const healthResponse = {
  200: z.object({
    ok: z.boolean(),
  }),
};

app.get(
  '/health',
  {
    request: healthRequest,
    response: healthResponse,
  },
  async ({ headers }) => ({
    status: 200,
    body: { ok: true },
  }),
);
```

含まれるもの:

- `createApp()`
- `app.get(path, contract, handler)`
- `app.fetch(request)`
- 固定pathのroute dispatch
- headers validation
- response validation
- 400 / 404 / 500
- Fetch handler

## 現在の実装状況

### Slice 2: GET + path params

実装済み。

- `:param` の動的 route matching
- params の抽出と Standard Schema validation
- static route の優先

### Slice 3: GET + query

実装済み。

- query の抽出
- 同名 query parameter の配列化
- schema 側の coercion / default / optional の尊重
- query validation error の 400

### Slice 4: POST + JSON body

実装済み。

- `app.post`
- JSON content type の body parsing
- body schema validation
- malformed JSON の 400
- GET route で body を読まない実装

### Slice 5: status 別 response

実装済み。

- status ごとの response schema 選択
- 未定義 status の 500
- response validation failure の 500
- response headers、文字列 response、空 response

### Slice 6: Error contract

実装済み。

- 400 / 404 / 500 の error response shape
- Standard Schema issue の path / message の保持
- handler や adapter の内部エラー情報を非露出

### Slice 7: middleware / hooks

middleware の基本部分は実装済み。

- app 全体に適用する middleware
- `Request → next() → Response` の Web 標準 middleware API
- middleware の short-circuit と response 置換

hooks は採用しない。middleware で handler 前後の処理を表現できるため、専用の lifecycle API は現時点では追加しない。

route 単位 middleware は `app.get(..., handler, ...middlewares)` の形式で実装済み。router composition でも group middleware の内側に適用される。

### Slice 8: router composition

基本部分を実装済み。

- `createRouter()`
- `app.route(prefix, router)`
- prefix 付き route 登録
- router 単位の group middleware

route 登録順や型推論の高度な整理は、実際の利用例を増やしてから必要な範囲で改善する。

### HTTP methods: PUT / PATCH / DELETE

実装済み。

- app と router の PUT / PATCH / DELETE route 登録
- 既存の params / query / JSON body validation の再利用
- composed router での method dispatch

### HTTP QUERY method

実装済み。

- `app.query()` と `router.query()`
- JSON query document の body validation
- `QUERY` method の composed router dispatch
- GET の URL query parameter とは別の HTTP method として扱う

### Slice 9: `mizu-node` adapter hardening

基本部分を実装済み。

`mizu-node`パッケージへ分離する。Node.js固有APIはCoreへ持ち込まない。

- Node.js request stream を Web `Request.body` へ接続
- Web `Response.body` の streaming 転送
- request / client disconnect の `AbortSignal` 連携
- request timeout、keep-alive timeout、headers timeout の設定
- `server.close()` による既存の graceful shutdown API の利用

### Slice 10: Cloudflare Workers adapter

基本部分を実装済み。

- `createWorkerHandler(app)` による Fetch handler 接続
- Core と同じ Web 標準 `Request` / `Response` の利用
- Node.js 固有 API への依存なし

Fetch Coreを`mizu`本体の標準entry pointとする。Cloudflare Workers以外のFetch対応runtimeでも同じhandlerを利用できる。

### Slice 11: Benchmark baseline

実装済み。

- `npm run bench` で Vitest benchmark を実行
- static / params route dispatch
- headers / query / JSON body validation
- response validation
- middleware
- `mizu-node` 経由の HTTP fetch

初回 baseline は実行環境依存だが、JSON body validation が Core の他の測定項目より遅い。Hono 4.13.9 と同一プロセスで比較できるベンチも追加した。

今回の測定値（ops/sec、同一実行環境の一回分）は次のとおり。

| ケース | mizu | Hono |
| --- | ---: | ---: |
| static route | 283,719 | 425,141 |
| params route | 259,893 | 398,691 |
| headers validation | 240,139 | 254,184 |
| query validation | 250,927 | 196,136 |
| JSON body validation | 68,195 | 81,437 |
| response validation | 267,693 | 53,847 |
| middleware | 276,008 | 360,993 |
| Node adapter | 2,381 | 4,023 |

Hono の validation は `@hono/zod-validator`、response validation は handler 内の Zod parse を使用しているため、response validation は完全な同一条件ではない。以後の最適化はこの baseline と比較して判断する。

### Slice 12: Performance optimization plan

benchmark baseline を壊さず、測定で効果を確認した変更だけを段階的に取り込む。validation を無効化する設定は追加しない。

#### 1. Route dispatch の前処理化

最優先。現在の request ごとの `filter().sort()` と path `split()` を route 登録時の処理へ移す。

- static route を method 別の `Map` で lookup
- dynamic route を method 別の segment Trieへ登録
- 512 route以下は末尾static segmentのdirect indexとsegment matcherをfast pathとして使用
- 513 route以上はTrieへ切り替える
- Trieのstatic childをparam childより優先して探索
- dynamic routeのparam名とroute metadataを登録時に保持
- static route を dynamic route より常に優先
- route 登録後のdispatchで候補配列のfilter / sortを実行しない
- params の抽出結果だけを request ごとに生成
- 1 param routeは登録時にprefix / suffixをコンパイルし、requestごとのpath splitを省略
- 2 param routeはprefix / 中間static segment / suffixを登録時にコンパイル
- 3 param routeは複数の中間static segmentを登録時にコンパイル
- 4 param以上は汎用segment matcherで処理

完了条件:

- static / params benchmark の ops/sec が baseline を下回らない
- static route の優先順位、404、params validation の既存テストが通る
- route 数を増やした benchmark で改善を確認する

#### 2. Request processing の軽量化

route dispatch 改善後に、入力が不要な route の処理を遅延させる。

- query schema がない route では query object を生成しない
- params / headers / query の context field を必要な場合だけ生成
- middleware chain を route 登録時に構築
- response schema lookup と response serialization の不要な分岐を削減

完了条件:

- headers / query / middleware benchmark を各変更前後で比較できる
- validation の実行回数と順序が変わらない
- request / response の公開挙動が既存テストで維持される

#### 3. `mizu-node` adapter の軽量化

Core の Web 標準境界を維持したまま、adapter 固有の変換コストを測定・削減する。

- AbortController と event listener の生成コストを確認
- request / response stream bridge の不要な変換を削減
- streaming response、client disconnect、timeout の挙動を維持
- `mizu-node` benchmark の throughput と latency を記録

完了条件:

- `mizu-node` の benchmark が baseline を下回らない
- body streaming と client disconnect のテストが通る
- Core に Node.js 固有 API を持ち込まない

#### 4. Hono 比較の再測定

各最適化 pass の最後に `npm run bench` を実行する。Hono の依存バージョン、Node.js version、実行環境を記録する。

比較条件は可能な限り統一する。

- Mizu / Honoともにasync handlerを使用する
- response shape、request生成、JSON body生成を一致させる
- validationの有無とライブラリ条件を一致させる
- route数、static / dynamic routeの配置を一致させる
- Node adapterは同じHTTP clientとwarm-up条件で測定する
- 1回の数値だけでなく複数回の傾向を確認する

params validationやresponse validationの条件が異なる測定値は、router性能の直接比較として扱わず、参考値として明記する。

ベンチ実装では、Mizu / Honoのhandlerをasyncに統一し、同じrequest factory、同じTinybench設定（`warmupTime: 250ms`、`time: 1000ms`）をCoreとNode adapterの全ケースへ適用している。Node adapterの測定も同じHTTP `fetch` clientと設定を使い、Mizu側は`mizu-node` package entryを経由する。

#### Slice 12 実施結果

2026-09-25 の `vitest bench --run` による再測定（ops/sec）は次のとおり。

| ケース | baseline mizu | optimized mizu | Hono |
| --- | ---: | ---: | ---: |
| static route | 283,719 | 315,528 | 427,327 |
| params route | 259,893 | 281,635 | 395,917 |
| headers validation | 240,139 | 261,806 | 254,742 |
| query validation | 250,927 | 270,311 | 200,742 |
| JSON body validation | 68,195 | 71,591 | 80,055 |
| response validation | 267,693 | 290,275 | 55,310 |
| middleware | 276,008 | 305,205 | 365,591 |
| Node adapter | 2,381 | 2,411 | 4,146 |

実行環境の揺れを含む一回の測定値だが、最適化後の全ケースで baseline を下回らなかった。route dispatch、query 遅延生成、middleware chain 事前構築、response schema validator 事前構築、Node response header 転送、method 別 dynamic route index を実装した。Node adapter では body streaming と client disconnect の回帰テストも追加した。

#### 比較条件平準化後の再測定

2026-09-25に同一プロセスで2回測定した。ops/secの範囲は次のとおり。

| ケース | Mizu | Hono |
| --- | ---: | ---: |
| static route | 323,657–324,137 | 404,768–407,247 |
| params route | 278,814–289,400 | 375,961–383,447 |
| headers validation | 258,378–265,430 | 252,456–255,770 |
| query validation | 270,640–274,684 | 197,984–198,560 |
| JSON body validation | 79,052–81,694 | 77,395–81,660 |
| response validation | 287,901–295,141 | 54,604–55,134 |
| middleware | 306,949–312,758 | 362,459–367,793 |
| Node adapter | 2,837–2,892 | 5,089–5,210 |

JSON body validationは同じZod schemaとbody factoryを使用しており、平準化後は近い値になった。一方、response validationはMizuのroute response validationとHono handler内のZod parseで実装位置が異なるため、引き続き直接比較ではなく参考値として扱う。

#### Trie化後のroute数別測定

同じ条件（`warmupTime: 250ms`、`time: 1000ms`）で、dynamic route数を増やして測定した。512 route以下はfast path、513 route以上はTrieを使用する。

| dynamic route数 | Mizu | Hono |
| ---: | ---: | ---: |
| 1 | 265,579 | 372,180 |
| 10 | 263,603 | 369,937 |
| 100 | 263,011 | 319,698 |
| 256 | 261,426 | 262,360 |
| 512 | 262,159 | 215,604 |
| 513 | 260,150 | 214,837 |
| 1,000 | 257,615 | 159,214 |

Mizuはroute数1〜1,000で約258k〜266k ops/secに収まり、fast pathからTrieへ切り替わる境界でも性能が安定した。最大256 routeの想定ではHonoとほぼ同等で、512 route以上ではMizuの優位性が現れる。一方、少数routeではHonoの絶対性能が高い。

Hono側にもMizuと同じZod params schemaを`zValidator('param', schema)`で適用した。1 param route benchmarkはMizu約276k / Hono約284k ops/sec、2 param route benchmarkはMizu約244k / Hono約266k ops/sec、3 param route benchmarkはMizu約229k / Hono約253k ops/secとなった。専用matcherは追加できたが、param数が増えるほどHonoとの差が残るため、次の最適化候補とする。

## Future roadmap after Phase 5

The following phases are the next implementation roadmap. The detailed historical Slice descriptions below remain as design records for the completed work.

### Phase 6: HTTP completeness and request/response helpers

Phase 5まででCoreの主要なroute、validation、middleware、adapter、benchmark基盤が揃ったため、次は実運用で不足するHTTP境界を埋める。HonoのAPIを互換実装するのではなく、Fetch APIと`path → contract → handler`の設計に合わせる。

実装候補:

- `HEAD`、`OPTIONS`、method未対応時の`405 Method Not Allowed`と`Allow`
- static / dynamic routeのwildcard・catch-all path
- path patternを指定できるapp / router middleware
- カスタム`notFound` / `onError`相当のerror handling hook
- `text()`、`formData()`、`arrayBuffer()`、`blob()`などのJSON以外のbody parsing
- text / JSON / stream / empty response helper
- raw `Request` / `Response`とURL、method、headersへの明示的なアクセス

検証:

- 既存path・未対応methodが404ではなく405になり、正しい`Allow`を返す
- wildcard routeのstatic優先順位とparams抽出が既存routeと矛盾しない
- bodyは一度だけ読み取られ、content typeごとのvalidationが400へ変換される
- response helperが複数headers、stream、204 / 304を壊さない

### Phase 7: Cookie and browser-facing middleware

Cookieを独立したSliceとして追加し、ブラウザから利用されるAPIに必要なmiddlewareを揃える。

実装候補:

- `Cookie` request headerのparse（空値、重複名、percent-encodingを含む）
- 複数の`Set-Cookie` response headerの追加
- `setCookie`、`deleteCookie`と`Max-Age`、`Expires`、`Domain`、`Path`、`Secure`、`HttpOnly`、`SameSite`、`Partitioned`
- `__Secure-` / `__Host-` prefixの属性整合性検証
- Web Cryptoを使うsigned cookie helper
- CORS middleware（origin、methods、headers、credentials、expose headers、max age）
- CSRF middleware（unsafe method、Origin、Sec-Fetch-Site、form系content type）
- secure headers middleware

Cookieは暗黙のhandler context状態ではなく、request helperとresponse header utilityで明示的に扱う。通常Cookieとsigned cookieはAPIを分離し、複数`Set-Cookie`をカンマ連結しない。

検証:

- `Cookie` headerから複数cookieを正しく取得できる
- 同名cookieとpercent-encodingの挙動が仕様化されている
- 一つのresponseに複数の独立した`Set-Cookie`を出力できる
- `__Host-` / `__Secure-`の不正な属性組み合わせを拒否できる
- CORS credentialsとwildcard originの不正な組み合わせを出力しない
- CSRFがsafe methodとunsafe methodを区別する

### Phase 8: Operational middleware

アプリケーション運用向けの汎用middlewareを、route dispatchとは分離して追加する。

実装候補:

- request loggerとconfigurable log sink
- request IDの生成・伝播
- ETagと`If-None-Match`
- JSON、text、form、streamのbody size limit
- runtime提供機能を優先するcompression adapter / middleware
- cache-control helper
- streaming response helper
- timeout / cancellation policyの共通化

既存の`Request → next() → Response`契約で実装できるものを優先し、新しいlifecycle hookは追加しない。

### Phase 9: Authentication and authorization helpers

認証方式をCoreのroute dispatchへ固定せず、middlewareと暗号ライブラリの境界を明確にする。

実装候補:

- Basic authentication
- Bearer token extraction
- Web Crypto対応範囲を明記したJWT verification middleware
- verified identity / claimsを後続handlerへ明示的かつ型安全に渡すcontext data API
- 401 responseと`WWW-Authenticate`
- 利用者がauthorization policyを組み立てるためのmiddleware API

OAuth、OIDC、Firebase、Auth.jsなどのprovider-specific integrationはMizu本体に含めず、別packageまたはthird-party middlewareの対象とする。

### Phase 10: Runtime adapters and platform features

Fetch Coreをruntime非依存に保ったまま、実行環境固有の機能をadapterへ追加する。

実装候補:

- `mizu-node`のstatic files / file response
- WebSocket upgrade adapter
- serverless adapter
- runtime environment access helper
- graceful shutdown、connection limits、compressionなどのNode adapter運用機能

検証:

- Coreの公開型にNode.jsやplatform固有型が混ざらない
- static files、WebSocket、streamingのadapter境界が明確である
- runtimeごとのdisconnect、timeout、shutdown挙動をテストできる

### Phase 11: Developer experience and testing

route contractを安全にテスト・再利用するためのDXを追加する。

実装候補:

- `app.fetch(new Request(...))`を簡単に呼ぶtesting helper
- route定義からTypeScript型を流すtyped test clientの検討
- response / error contractのfixture helper
- benchmarkとruntime adapter testの標準化
- runtime別sampleとmigration documentation

typed clientはTypeScript型を共有する範囲に限定し、OpenAPI、JSON Schema、他言語SDK生成は対象外とする。

### Hono comparison: explicit out of scope

Honoに存在することだけを理由に、次の機能はMizu本体へ追加しない。

- OpenAPI / JSON Schemaの生成・読み込み
- 他言語向け型・SDK生成
- ORM / database abstraction
- DI container、decorator、class-based DTO
- JSX / HTML rendering
- GraphQL server
- OAuth / OIDC provider-specific integrations
- SSG / frontend build system
- RPC専用procedure API

これらはMizuの薄いFetch Coreと`path → contract → handler`を損なう可能性が高いため、必要時は別packageまたは利用者側の統合で解決する。

## Phase 1: Request入力の拡張

### Slice 2: GET + path params

目的は、固定pathから動的pathへ広げること。

```ts
app.get(
  '/todos/:id',
  {
    request: {
      params: z.object({
        id: z.string(),
      }),
    },
    response: {
      200: todoSchema,
      404: errorSchema,
    },
  },
  async ({ params }) => {
    // params.id は string
  },
);
```

実装対象:

- `:param` のroute matching
- paramsの抽出
- params schemaのvalidation
- static routeとdynamic routeの優先順位

検証:

- `/todos/1` がhandlerへ `params.id = "1"` を渡す
- pathが一致しないrouteは404
- params validation failureは400
- 同一method・pathでstatic routeがdynamic routeより優先される

### Slice 3: GET + query

```ts
app.get(
  '/todos',
  {
    request: {
      query: z.object({
        completed: z.coerce.boolean().optional(),
      }),
    },
    response: {
      200: z.array(todoSchema),
    },
  },
  async ({ query }) => {
    // query.completed は boolean | undefined
  },
);
```

実装対象:

- URL queryの抽出
- 同名query parameterの扱い
- schema側のcoercion / default / optionalの尊重
- query validation errorの400

### Slice 4: POST + JSON body

```ts
app.post(
  '/todos',
  {
    request: {
      body: z.object({
        title: z.string().trim().min(1),
      }),
    },
    response: {
      201: todoSchema,
    },
  },
  async ({ body }) => {
    // body.title は string
  },
);
```

実装対象:

- `app.post`
- JSON content typeのbody parsing
- body schemaのvalidation
- malformed JSONの400
- GETなどbodyを持たないmethodではbodyを読まない
- request bodyの二重読み取りをしない

## Phase 2: Responseとエラー

### Slice 5: status別response

response schemaをHTTP statusに結び付ける。

```ts
response: {
  200: todoSchema,
  404: errorSchema,
}
```

実装対象:

- handler resultのstatusとbodyの処理
- statusごとのresponse schema選択
- statusに対応するschemaがないhandler resultの扱い
- response validation failureの500
- JSON以外のresponse、空response、headersの扱い

statusとbodyの対応をhandlerの型で厳密に表現するため、必要なら専用helperを導入する。

```ts
return response.status(201, todo);
```

ただし、専用helperの採用は実際のhandlerの書き味を確認してから決める。

### Slice 6: Error contract

validation error、not found、handler errorを、利用者が扱いやすいerror responseへ整理する。

実装対象:

- error responseの形
- Standard Schema issueのpath / messageの扱い
- productionでの内部エラー情報の非露出
- handlerがthrowした値のHTTP変換
- adapter境界での未処理例外

Mizuはvalidationライブラリ固有のstrict / passthrough / strip / transformを再実装しない。schemaのoutputとissueを受け取り、HTTPへ接続するだけにする。

## Phase 3: Application composition

### Slice 7: middleware / hooks

認証、logging、request IDなどの横断処理を追加する。

app 全体 middleware と router 単位 middleware は実装済み。hooks は採用しない。

優先順位:

1. app全体に適用するmiddleware
2. route groupに適用するmiddleware
3. route単位のmiddleware
4. handler 前後の hooks（採用しない）

middlewareはWeb標準のRequest / Responseを扱い、Node.js固有の型をCoreへ持ち込まない。

### Slice 8: router composition

routeをファイルや機能単位に分割できるようにする。

```ts
app.route('/todos', todoRoutes);
```

実装対象:

- route groupのprefix
- group単位のmiddleware
- route登録順序の明確化
- 型推論を壊さないroute composition

## Phase 4: Runtime adapters

### Slice 9: `mizu-node` adapterの実運用化

`mizu-node`を、実運用で使える最低限のNode.js server packageとして提供する。

実装対象:

- request body streamの読み取り
- content type
- streaming response
- graceful shutdown
- AbortSignal
- client disconnect
- keep-aliveとtimeout

### Slice 10: Cloudflare Workers adapter

`mizu`のFetch handlerをCloudflare Workersへ接続する。

```ts
export default {
  fetch: app.fetch,
};
```

検証対象:

- Node.jsとWorkersで同じroute / handlerが動く
- Web標準Request / Responseだけでhandlerを記述できる
- Node.js固有APIへの暗黙依存がない

## Phase 5: Performance

### Slice 11: Benchmark baseline

機能追加と分離して、性能の基準値を作る。

測定対象:

- static route dispatch
- params route dispatch
- headers validation
- query validation
- JSON body validation
- response validation on / offではなく、response schemaあり / なし
- middlewareあり / なし
- `mizu-node`経由のthroughputとlatency

Mizu側でvalidationを無効化する設定は作らない。validationの最適化やpassthroughは利用するStandard Schema実装の責務とする。Mizuはschema形式の変換やreflectionを追加せず、validationライブラリの最適化を妨げない。

最適化はbenchmarkでボトルネックを確認してから行う。route登録時の前処理、context生成、JSON serialization、adapter変換を個別に測定する。

## 優先順位

```text
GET headers                 完了
GET params                 完了
GET query                  完了
POST JSON body             完了
status別response           完了
error contract             完了
app middleware             完了
router composition         完了（基本形）
route middleware           完了
hooks                      採用しない
PUT / PATCH / DELETE       完了
HTTP QUERY method          完了
`mizu-node` adapter hardening  完了（基本形）
Cloudflare Workers adapter 完了（基本形）
performance benchmark    完了（baseline / remeasure）
route dispatch optimization 完了
request processing optimization 完了
`mizu-node` optimization 完了（header transfer / disconnect verification）
Hono comparison remeasure 完了
async-only public API migration 完了
`mizu-node` workspace package化 完了（root compatibility exportあり）
HTTP completeness and request/response helpers 進行中（HEAD / OPTIONS / 405 / wildcard 完了）
Cookie and browser-facing middleware 進行中（通常Cookie / signed cookie / CORS / CSRF 完了）
Operational middleware 進行中（secure headers / logger / request ID / ETag / cache-control 完了）
Authentication and authorization helpers 計画
Runtime adapters and platform features 計画
Developer experience and testing 計画
```

## 対象外

以下はMizuの実装計画に含めない。

- OpenAPIの生成・読み込み
- JSON Schemaの生成・読み込み
- 他言語向けの型・SDK生成
- API仕様ファイルを正とする設計
- decorator-based controller
- DI container
- class-based DTO
- ORM / database abstraction
- RPC専用API

Mizuは、TypeScriptの型をfrontendと共有したい場合、またはFetch APIを提供するWeb標準runtimeを使いたい場合に選ぶ、低オーバーヘッドなAPIサーバCoreを目指す。Node.jsでserverを起動する場合は`mizu-node`を追加する。大規模なAPIも作れるが、大規模アプリケーション全体の構造や業務基盤を内蔵することは目的にしない。
