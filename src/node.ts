import { createServer, type IncomingHttpHeaders, type Server } from 'node:http';
import type { MizuApp } from './types.js';

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

export function createNodeServer(app: MizuApp): Server {
  return createServer(async (request, response) => {
    try {
      const host = request.headers.host ?? 'localhost';
      const url = new URL(request.url ?? '/', `http://${host}`);
      const webRequest = new Request(url, {
        method: request.method,
        headers: toHeaders(request.headers),
      });
      const webResponse = await app.fetch(webRequest);

      response.statusCode = webResponse.status;
      webResponse.headers.forEach((value, key) => response.setHeader(key, value));
      response.end(Buffer.from(await webResponse.arrayBuffer()));
    } catch {
      response.statusCode = 500;
      response.setHeader('content-type', 'application/json; charset=utf-8');
      response.end(JSON.stringify({ error: 'Internal Server Error' }));
    }
  });
}
