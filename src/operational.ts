import type { Middleware } from './types.js';

export type LogSink = (message: string) => void;

export function logger(sink: LogSink = (message) => console.log(message)): Middleware {
  return async (request, next) => {
    const started = performance.now();
    const response = await next();
    const duration = Math.round(performance.now() - started);
    const url = new URL(request.url);

    sink(`${request.method} ${url.pathname} ${response.status} ${duration}ms`);
    return response;
  };
}

export type RequestIdOptions = {
  header?: string;
  generate?: () => string;
};

export function requestId(options: RequestIdOptions = {}): Middleware {
  const header = options.header ?? 'x-request-id';
  const generate = options.generate ?? (() => crypto.randomUUID());

  return async (request, next) => {
    const id = request.headers.get(header) ?? generate();
    const response = await next();

    if (!response.headers.has(header)) response.headers.set(header, id);
    return response;
  };
}

export function cacheControl(value: string): Middleware {
  return async (_request, next) => {
    const response = await next();
    if (!response.headers.has('cache-control')) {
      response.headers.set('cache-control', value);
    }
    return response;
  };
}

export function bodyLimit(maxBytes: number): Middleware {
  if (!Number.isFinite(maxBytes) || maxBytes < 0) {
    throw new Error('maxBytes must be a non-negative finite number');
  }

  return async (request, next) => {
    const contentLength = request.headers.get('content-length');
    const declaredLength = contentLength === null
      ? undefined
      : Number(contentLength);

    if (
      declaredLength !== undefined &&
      Number.isFinite(declaredLength) &&
      declaredLength > maxBytes
    ) {
      return new Response('Payload Too Large', { status: 413 });
    }

    return next();
  };
}
