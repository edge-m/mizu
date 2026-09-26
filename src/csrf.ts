import type { Middleware } from './types.js';

export type CsrfOrigin =
  | string
  | string[]
  | ((origin: string, request: Request) => boolean);

export type CsrfOptions = {
  origin?: CsrfOrigin;
};

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const FORM_CONTENT_TYPES = new Set([
  'application/x-www-form-urlencoded',
  'multipart/form-data',
  'text/plain',
]);

function isAllowedOrigin(
  origin: string,
  request: Request,
  configuredOrigin: CsrfOrigin | undefined,
): boolean {
  if (configuredOrigin === undefined) {
    return origin === new URL(request.url).origin;
  }

  if (typeof configuredOrigin === 'function') {
    return configuredOrigin(origin, request);
  }

  return Array.isArray(configuredOrigin)
    ? configuredOrigin.includes(origin)
    : configuredOrigin === origin;
}

function forbidden(): Response {
  return new Response('Forbidden', { status: 403 });
}

export function csrf(options: CsrfOptions = {}): Middleware {
  return async (request, next) => {
    if (SAFE_METHODS.has(request.method)) return next();

    const contentType = request.headers.get('content-type')
      ?.split(';', 1)[0]
      .trim()
      .toLowerCase();
    if (!contentType || !FORM_CONTENT_TYPES.has(contentType)) return next();

    const origin = request.headers.get('origin');
    const fetchSite = request.headers.get('sec-fetch-site');

    if (fetchSite && !['same-origin', 'none'].includes(fetchSite)) {
      return forbidden();
    }

    if (origin && !isAllowedOrigin(origin, request, options.origin)) {
      return forbidden();
    }

    return next();
  };
}
