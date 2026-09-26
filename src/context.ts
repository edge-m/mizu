import type { ResponseData } from './types.js';

export type ContextVariables = Record<string, any>;

export class Context<Variables extends ContextVariables = ContextVariables> {
  readonly request: Request;
  readonly url: URL;
  readonly method: string;
  readonly signal: AbortSignal;
  routePath?: string;
  basePath?: string;

  private readonly values = new Map<string, unknown>();
  private readonly responseHeaders = new Headers();

  constructor(request: Request, url = new URL(request.url)) {
    this.request = request;
    this.url = url;
    this.method = request.method;
    this.signal = request.signal;
  }

  setRouteInfo(routePath: string, basePath: string): void {
    this.routePath = routePath;
    this.basePath = basePath;
  }

  header(name: string, value: string): void {
    this.responseHeaders.set(name, value);
  }

  set<Key extends keyof Variables>(key: Key, value: Variables[Key]): void {
    this.values.set(String(key), value);
  }

  get<Key extends keyof Variables>(key: Key): Variables[Key] {
    return this.values.get(String(key)) as Variables[Key];
  }

  text(body: string, status = 200): ResponseData<string> {
    return this.result(body, status);
  }

  json<Body>(body: Body, status = 200): ResponseData<Body> {
    return this.result(body, status);
  }

  empty(status = 204): ResponseData<undefined> {
    return this.result(undefined, status);
  }

  stream(
    body: ReadableStream,
    status = 200,
  ): ResponseData<ReadableStream> {
    return this.result(body, status);
  }

  private result<Body>(body: Body, status: number): ResponseData<Body> {
    return {
      status,
      body,
      headers: new Headers(this.responseHeaders),
    };
  }
}
