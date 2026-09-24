# mizu 実装計画

## 方針

mizuは、細く薄いVertical Sliceを順番に通し、各Sliceが実際に動く状態を維持しながら機能の幅を広げる。

設計の中心は次のとおり。

- Web標準APIを中心にしたCore
- Node.jsを第一ターゲットにした実行環境
- Cloudflare Workersへ展開可能なadapter境界
- Standard Schemaによるruntime validationと型推論
- `path → contract → handler` の宣言順序
- request / responseを同じroute contractで扱う
- OpenAPIやJSON Schemaのような言語間契約は扱わない
- decorator、DI container、class-based DTOを必須にしない

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
- Node.js adapter

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

優先順位:

1. app全体に適用するmiddleware
2. route groupに適用するmiddleware
3. route単位のmiddleware
4. handler前後のhooks

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

### Slice 9: Node.js adapterの実運用化

現在のadapterを、実運用で使える最低限のNode.js serverへ広げる。

実装対象:

- request body streamの読み取り
- content type
- streaming response
- graceful shutdown
- AbortSignal
- client disconnect
- keep-aliveとtimeout

### Slice 10: Cloudflare Workers adapter

Coreを変更せず、Fetch handlerとしてCloudflare Workersへ接続する。

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
- Node.js adapter経由のthroughputとlatency

Mizu側でvalidationを無効化する設定は作らない。validationの最適化やpassthroughは利用するStandard Schema実装の責務とする。Mizuはschema形式の変換やreflectionを追加せず、validationライブラリの最適化を妨げない。

最適化はbenchmarkでボトルネックを確認してから行う。route登録時の前処理、context生成、JSON serialization、adapter変換を個別に測定する。

## 優先順位

```text
GET headers                 完了
GET params                 次
GET query
POST JSON body
status別response
error contract
middleware
router composition
Node.js adapter hardening
Cloudflare Workers adapter
performance benchmark
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

Mizuは、TypeScriptの型をfrontendと共有したい場合、またはNode.js / Cloudflare WorkersのWeb標準runtimeを使いたい場合に選ぶ、低オーバーヘッドなAPIサーバCoreを目指す。大規模なAPIも作れるが、大規模アプリケーション全体の構造や業務基盤を内蔵することは目的にしない。
