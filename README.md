# mizu

軽量で型安全な Node.js 向け API サーバライブラリです。Hono のような軽快な開発体験と、バックエンドエンジニアが扱いやすい型安全な外部 API を目指します。

現在はライブラリ基盤の初期段階です。HTTP サーバの起動、ルーティング、ミドルウェアなどのサーバ API はこれから実装します。

API と開発者体験の方針は [API / DX 方針](./docs/api-design.md) にまとめています。

## 要件

- Node.js 22 以上

## 開発

```sh
npm install
npm test
npm run typecheck
npm run build
```

開発中の TypeScript 実行には `npm run dev` を使えます。公開エントリポイントは `src/index.ts` に集約し、配布成果物は `dist/` に生成します。

## ライセンス

ライセンスは API の初期設計と合わせて定義します。
