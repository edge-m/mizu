# mizu API / DX 方針

## 概要

mizu は、Node.js 向けの軽量な API サーバライブラリである。

目標は、Hono のような軽快さを保ちながら、リクエストとレスポンスの契約を route declaration に集約し、handler まで一貫して型安全にすること。利用者は HTTP の外部仕様を宣言し、その仕様を実装する handler を書く。

中心となる読み方は次の順序である。

```text
Schema → Route contract → Handler
```

- Schema: 実行時バリデーションと静的型の元になる
- Route contract: URL、入力、出力をHTTPルートへ接続する
- Handler: 検証済みの入力を受け、契約に適合する出力を返す

## 基本API

ルート登録は次の形を基本とする。

```ts
app.post(path, contract, handler)
```

具体例:

```ts
import { z } from 'zod';
import { createApp } from 'mizu';

const app = createApp();

const createTodoRequest = {
  body: z.object({
    title: z.string().trim().min(1).max(100),
  }),
};

const createTodoResponse = {
  201: z.object({
    id: z.string(),
    title: z.string(),
    completed: z.boolean(),
  }),
};

app.post(
  '/todos',
  {
    request: createTodoRequest,
    response: createTodoResponse,
  },
  async ({ body }) => {
    return {
      status: 201,
      body: {
        id: crypto.randomUUID(),
        title: body.title,
        completed: false,
      },
    };
  },
);
```

handlerの戻り値は、HTTP statusとbodyを持つ内部的なresponse envelopeとする。`status` はHTTP responseへ反映され、`body` はwire formatのbodyになる。status自体がJSON bodyへ含まれるわけではない。

```ts
return {
  status: 201,
  body: {
    id: crypto.randomUUID(),
    title: body.title,
    completed: false,
  },
};
```

利用者が読むべき情報が `path → contract → handler` の順に並ぶため、ルートの外部仕様と実装の対応を追いやすい。

## Contract の構造

contract はリクエストとレスポンスを分離する。

```ts
type RouteContract = {
  request?: {
    headers?: StandardSchema;
    params?: StandardSchema;
    query?: StandardSchema;
    body?: StandardSchema;
  };
  response?: {
    [status: number]: StandardSchema;
  };
};
```

### Request

HTTP入力の取得元ごとにschemaを分ける。

```ts
const getTodoRequest = {
  headers: authHeadersSchema,
  params: z.object({
    id: z.string(),
  }),
  query: z.object({
    detail: z.coerce.boolean().optional(),
  }),
};
```

handlerには、schemaのoutput型から推論された検証済みの値を渡す。

```ts
app.get(
  '/todos/:id',
  { request: getTodoRequest },
  async ({ headers, params, query }) => {
    // headers, params, query は各schemaのoutput型
  },
);
```

`body`、`query`、`params`、`headers` はHTTP上の意味が異なるため、単一の大きなschemaに詰め込まず、個別のフィールドとして表現する。

### Response

レスポンスは HTTP status code ごとにschemaを指定する。

```ts
const getTodoResponse = {
  200: todoSchema,
  404: errorSchema,
};
```

handlerの戻り値は、登録されているstatusのいずれかに対応しなければならない。status codeをbodyへ埋め込む形式ではなく、HTTPのstatusとして扱う。

この表現により、成功・エラーの外部仕様、レスポンス検証、OpenAPI生成を同じ宣言から扱える。

## Schema と型推論

mizu は特定のvalidationライブラリに固定せず、Standard Schemaを契約とする。Zodを最初に使いやすい実装として想定するが、利用者が別のStandard Schema互換ライブラリを選ぶことを妨げない。

```ts
app.post(
  '/todos',
  {
    request: {
      body: z.object({
        title: z.string(),
      }),
    },
    response: {
      201: todoSchema,
    },
  },
  async ({ body }) => {
    body.title; // string

    return {
      status: 201,
      body: {
        id: 'todo-1',
        title: body.title,
        completed: false,
      },
    };
  },
);
```

ジェネリクスを利用者が手動で指定するのではなく、route contractに渡されたschemaからhandlerの引数と戻り値を推論する。これにより、型定義とruntime validationの二重記述を避ける。

ただし、TypeScriptの型情報だけではruntime validationはできない。schemaの値をroute contractに渡すことで、同じ定義をコンパイル時と実行時の両方で利用する。

## Handler

handlerはroute contractの実装である。

```ts
type Handler<Contract> = (
  context: InferRequest<Contract['request']>,
) => MaybePromise<InferResponse<Contract['response']>>;
```

通常は `app.post` の型推論に任せ、handlerへ明示的なジェネリクスを付けない。

handlerを別ファイルに分離する場合は、route contractからhandler型を作れるようにする。

```ts
const createTodoContract = {
  request: createTodoRequest,
  response: createTodoResponse,
};

const createTodo: Handler<typeof createTodoContract> = async ({ body }) => {
  return {
    status: 201,
    body: {
      id: crypto.randomUUID(),
      title: body.title,
      completed: false,
    },
  };
};

app.post('/todos', createTodoContract, createTodo);
```

## APIの設計原則

### 宣言を先に読む

handlerの中身を読まなくても、path・入力・出力の仕様を把握できるようにする。

### 入力と出力を同じ重さで扱う

入力validationだけでなく、responseの型検査・runtime validation・status別仕様も標準機能にする。

### HTTPの意味をAPIに反映する

body、query、params、headersを区別し、response statusをHTTP statusとして表現する。汎用的な一つのcontextにすべてを隠さない。

### 型指定を重複させない

schemaを値として渡せば、handlerの型は推論される。型だけのジェネリクスを別途書くことを基本のDXにしない。

### コアは薄く保つ

decorator、DI container、class-based DTOを必須にしない。middlewareやpluginによる拡張余地は持たせるが、最初のroute登録に複雑な実行モデルを要求しない。

## 他フレームワークとの位置づけ

- Express: routingとmiddlewareの最小プリミティブ。mizuは契約と型推論を標準化する。
- Hono: 軽量でWeb標準寄り。mizuはvalidationをmiddlewareの組み合わせではなくroute contractの中心に置く。
- Fastify: schema-based validationと高性能なserializationが強い。mizuはStandard Schemaと宣言の読みやすさを優先する。
- NestJS: module、decorator、DIを含む大きなアプリケーションフレームワーク。mizuはそれらを必須にしない。
- Elysia: schemaから型・validation・OpenAPIをまとめる体験が近い。mizuはNode.jsを第一ターゲットにし、`path → contract → handler` の順序を採用する。

mizuの差別化の中心は、Standard Schema対応そのものではなく、HTTPの入出力契約を読みやすい形で一つのroute declarationにまとめ、handlerへ自然に型を流すことである。

## 初期スコープ外

- DI container
- decorator-based controller
- class-based DTO
- schemaライブラリ独自のAPI
- 自動的なデータベース・ORM連携
- RPC専用のprocedure API
