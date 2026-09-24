import { createServer, type IncomingHttpHeaders, type Server } from 'node:http';
import { Readable } from 'node:stream';
import type { ReadableStream as NodeReadableStream } from 'node:stream/web';
import type { MizuApp } from './types.js';

export type NodeServerOptions = {
  requestTimeout?: number;
  keepAliveTimeout?: number;
  headersTimeout?: number;
};

function toHeaders(input: IncomingHttpHeaders): Headers {
  const headers = new Headers();

  for (const [key, value] of Object.entries(input)) {
    if (Array.isArray(value)) {
      for (const item of value) headers.append(key, item);
    } else if (value !== undefined) {
      headers.set(key, value);
    }
  }

  return headers;
}

export function createNodeServer(
  app: MizuApp,
  options: NodeServerOptions = {},
): Server {
  const server = createServer(async (request, response) => {
    const abortController = new AbortController();
    const abortRequest = () => abortController.abort();
    const abortOnDisconnect = () => {
      if (!request.complete && !response.writableEnded) {
        abortController.abort();
      }
    };

    request.once('aborted', abortRequest);
    request.once('close', abortOnDisconnect);
    response.once('close', abortOnDisconnect);

    try {
      const host = request.headers.host ?? 'localhost';
      const url = new URL(request.url ?? '/', `http://${host}`);
      const requestInit: RequestInit & { duplex?: 'half' } = {
        method: request.method,
        headers: toHeaders(request.headers),
        signal: abortController.signal,
      };

      if (request.method !== 'GET' && request.method !== 'HEAD') {
        requestInit.body = Readable.toWeb(request) as ReadableStream;
        requestInit.duplex = 'half';
      }

      const webRequest = new Request(url, requestInit);
      const webResponse = await app.fetch(webRequest);

      response.statusCode = webResponse.status;
      webResponse.headers.forEach((value, key) => response.setHeader(key, value));

      if (!webResponse.body) {
        response.end();
      } else {
        const body = Readable.fromWeb(
          webResponse.body as unknown as NodeReadableStream<any>,
        );
        body.on('error', () => response.destroy());
        body.pipe(response);
      }
    } catch {
      if (!response.headersSent) {
        response.statusCode = 500;
        response.setHeader('content-type', 'application/json; charset=utf-8');
        response.end(JSON.stringify({ error: 'Internal Server Error' }));
      } else {
        response.destroy();
      }
    } finally {
      request.removeListener('aborted', abortRequest);
      request.removeListener('close', abortOnDisconnect);
    }
  });

  if (options.requestTimeout !== undefined) {
    server.requestTimeout = options.requestTimeout;
  }
  if (options.keepAliveTimeout !== undefined) {
    server.keepAliveTimeout = options.keepAliveTimeout;
  }
  if (options.headersTimeout !== undefined) {
    server.headersTimeout = options.headersTimeout;
  }

  return server;
}
