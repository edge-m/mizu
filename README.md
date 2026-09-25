# mizu

軽量で型安全な Fetch API ベースの API サーバCoreです。Node.jsでHTTP serverを起動する場合は、`mizu-node` adapterを追加します。

handlerとmiddlewareはasync-onlyです。Node.js adapterを使う場合は、Coreとadapterを分けて導入します。

API と開発者体験の方針は [API / DX 方針](./docs/api-design.md) にまとめています。
実装の段階的な計画は [実装計画](./docs/implementation-plan.md) にまとめています。

## 要件

- Node.js 22 以上

## 開発

```sh
npm install
npm test
npm run typecheck
npm run build
```

Node.js serverを起動する場合:

```sh
npm install mizu mizu-node
```

```ts
import { createApp } from 'mizu';
import { createNodeServer } from 'mizu-node';

const app = createApp();
app.get('/health', {}, async () => ({
  status: 200,
  body: { ok: true },
}));

createNodeServer(app).listen(3000);
```

既存の `mizu` からの `createNodeServer` importは互換性のため当面利用できますが、新規コードでは `mizu-node` を推奨します。

開発中の TypeScript 実行には `npm run dev` を使えます。公開エントリポイントは `src/index.ts` に集約し、配布成果物は `dist/` に生成します。

## ライセンス

ライセンスは API の初期設計と合わせて定義します。
