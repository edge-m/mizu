import type { Middleware } from './types.js';

export type CorsOrigin =
  | string
  | string[]
  | ((origin: string, request: Request) => string | undefined);

export type CorsOptions = {
  origin?: CorsOrigin;
  allowMethods?: string[];
  allowHeaders?: string[];
  exposeHeaders?: string[];
  maxAge?: number;
  credentials?: boolean;
};

function resolveOrigin(
  origin: string,
  request: Request,
  configuredOrigin: CorsOrigin | undefined,
  credentials: boolean,
): string | undefined {
  if (configuredOrigin === undefined || configuredOrigin === '*') {
    return credentials ? origin : '*';
  }

  if (typeof configuredOrigin === 'function') {
    return configuredOrigin(origin, request);
  }

  if (Array.isArray(configuredOrigin)) {
    return configuredOrigin.includes(origin) ? origin : undefined;
  }

  return configuredOrigin === origin ? origin : undefined;
}

function appendVary(headers: Headers, value: string): void {
  const current = headers.get('vary');
  const values = current ? current.split(',').map((item) => item.trim()) : [];
  if (!values.includes(value)) values.push(value);
  headers.set('vary', values.join(', '));
}

export function cors(options: CorsOptions = {}): Middleware {
  const allowMethods = options.allowMethods ?? [
    'GET',
    'HEAD',
    'POST',
    'PUT',
    'PATCH',
    'DELETE',
    'QUERY',
  ];

  return async (request, next) => {
    const requestOrigin = request.headers.get('origin');
    if (!requestOrigin) return next();

    const allowedOrigin = resolveOrigin(
      requestOrigin,
      request,
      options.origin,
      options.credentials ?? false,
    );
    const requestMethod = request.headers.get('access-control-request-method');
    const preflight = request.method === 'OPTIONS' && requestMethod !== null;

    if (!allowedOrigin) return next();

    const response = preflight
      ? new Response(null, { status: 204 })
      : await next();
    response.headers.set('access-control-allow-origin', allowedOrigin);

    if (allowedOrigin !== '*') appendVary(response.headers, 'Origin');
    if (options.credentials) {
      response.headers.set('access-control-allow-credentials', 'true');
    }

    if (options.exposeHeaders?.length) {
      response.headers.set(
        'access-control-expose-headers',
        options.exposeHeaders.join(', '),
      );
    }

    if (preflight) {
      response.headers.set(
        'access-control-allow-methods',
        allowMethods.join(', '),
      );
      if (options.allowHeaders?.length) {
        response.headers.set(
          'access-control-allow-headers',
          options.allowHeaders.join(', '),
        );
      }
      if (options.maxAge !== undefined) {
        response.headers.set(
          'access-control-max-age',
          String(Math.trunc(options.maxAge)),
        );
      }
    }

    return response;
  };
}
