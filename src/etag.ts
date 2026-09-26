import type { Middleware } from './types.js';

function toHex(bytes: Uint8Array): string {
  return [...bytes]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function matchesEntityTag(header: string, etag: string): boolean {
  return header
    .split(',')
    .map((value) => value.trim())
    .some((value) => value === '*' || value.replace(/^W\//, '') === etag);
}

export function etag(): Middleware {
  return async (request, next) => {
    const response = await next();
    if (response.status === 204 || response.status === 304 || !response.body) {
      return response;
    }

    if (!response.headers.has('etag')) {
      const digest = await crypto.subtle.digest(
        'SHA-256',
        await response.clone().arrayBuffer(),
      );
      response.headers.set(
        'etag',
        `"${toHex(new Uint8Array(digest))}"`,
      );
    }

    const responseTag = response.headers.get('etag');
    const requestTag = request.headers.get('if-none-match');
    if (responseTag && requestTag && matchesEntityTag(requestTag, responseTag)) {
      return new Response(null, {
        status: 304,
        headers: response.headers,
      });
    }

    return response;
  };
}
