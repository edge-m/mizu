import type { MizuApp } from './types.js';

export function request(
  app: Pick<MizuApp, 'fetch'>,
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  return app.fetch(new Request(input, init));
}
