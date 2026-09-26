import type { Middleware } from './types.js';

export class BodyLimitExceeded extends Error {
  constructor() {
    super('Request body exceeds the configured limit');
  }
}

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

    if (!request.body) return next();

    const reader = request.body.getReader();
    let received = 0;
    const limitedBody = new ReadableStream<Uint8Array>({
      async pull(controller) {
        const { done, value } = await reader.read();
        if (done) {
          controller.close();
          return;
        }

        received += value.byteLength;
        if (received > maxBytes) {
          await reader.cancel();
          controller.error(new BodyLimitExceeded());
          return;
        }

        controller.enqueue(value);
      },
      async cancel(reason) {
        await reader.cancel(reason);
      },
    });

    const headers = new Headers(request.headers);
    headers.delete('content-length');
    const limitedRequest = new Request(request, {
      body: limitedBody,
      headers,
      duplex: 'half',
    } as RequestInit & { duplex: 'half' });

    return next(limitedRequest);
  };
}
