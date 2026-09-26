# mizu Extension Boundaries

この文書は、Fetch APIを中心とするmizu Coreと、runtimeまたは仕様固有の拡張の責務を分けるための契約を定義する。

## Core

CoreはWeb標準の`Request`、`Response`、`ReadableStream`、`AbortSignal`だけを公開型に使う。

- route matching、contract validation、`Context`、response helper
- `text`、`json`、`empty`、`stream`のresponse data
- body extractionとrequest-scoped metadata
- error handling、testing helper

CoreはNode.jsの`IncomingMessage`、`ServerResponse`、upgrade socket、platform固有のenvironment APIを参照しない。

## Adapter

adapterはCoreの`fetch`境界をruntimeのserver lifecycleへ接続する。

- `mizu-node`: Node HTTP server、client disconnect、Node stream lifecycle
- Workers adapter: platform fetch handler、execution context
- 将来のBun / Deno adapter: 各runtimeのlisten、env、shutdown API

adapterはroute contractを再定義せず、Coreが返した`Response`をruntimeへ渡す。disconnectやtimeoutの挙動はadapterごとのテストで保証する。

## Separate packages

仕様や生成物がCoreのHTTP契約を隠す場合は別packageに置く。

| 機能 | 境界 | 契約 |
| --- | --- | --- |
| SSE | helperまたはadapter | Coreはstream response、イベント形式は拡張側 |
| WebSocket | runtime adapter | HTTP route contractとは別のupgrade API |
| OpenAPI | generator package | Standard Schemaとroute metadataを入力にする。OpenAPIは正にしない |
| RPC client | client package | HTTP routeとstatus別responseを正にする |
| runtime env helper | adapter | Node/Bun/Deno型をCoreへ逆輸出しない |

JSX、SSG、GraphQL、OAuth/OIDC provider integration、ORM、DI containerはこの境界の外であり、Core roadmapには追加しない。
