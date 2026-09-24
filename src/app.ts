import type { StandardSchemaV1 } from '@standard-schema/spec';
import type {
  AnySchema,
  GetContract,
  GetHandler,
  Middleware,
  MizuApp,
  MizuRouter,
  DeleteContract,
  DeleteHandler,
  PatchContract,
  PatchHandler,
  PostContract,
  PostHandler,
  PutContract,
  PutHandler,
  QueryContract,
  QueryHandler,
  RouteContract,
  SchemaOutput,
} from './types.js';

type RouteDefinition = {
  method: string;
  path: string;
  contract: RouteContract;
  handler: (context: Record<string, unknown>) => unknown;
};

type RegisteredRoute = RouteDefinition & {
  middlewares: Middleware[];
};

type InternalRouter = MizuRouter & {
  definitions: RouteDefinition[];
  middlewares: Middleware[];
};

function joinPaths(prefix: string, path: string): string {
  const normalizedPrefix = prefix === '/' ? '' : prefix.replace(/\/$/, '');
  const normalizedPath = path === '/' ? '' : path.replace(/^\//, '');
  return `${normalizedPrefix}/${normalizedPath}` || '/';
}

function routeDefinition(
  method: string,
  path: string,
  contract: RouteContract,
  handler: (context: Record<string, unknown>) => unknown,
): RouteDefinition {
  return { method, path, contract, handler };
}

function matchPath(
  routePath: string,
  pathname: string,
): Record<string, string> | null {
  const routeSegments = routePath.split('/');
  const pathSegments = pathname.split('/');

  if (routeSegments.length !== pathSegments.length) {
    return null;
  }

  const params: Record<string, string> = {};

  for (let index = 0; index < routeSegments.length; index += 1) {
    const routeSegment = routeSegments[index];
    const pathSegment = pathSegments[index];

    if (routeSegment.startsWith(':')) {
      params[routeSegment.slice(1)] = decodeURIComponent(pathSegment);
    } else if (routeSegment !== pathSegment) {
      return null;
    }
  }

  return params;
}

function isDynamicPath(path: string): boolean {
  return path.split('/').some((segment) => segment.startsWith(':'));
}

class ValidationFailure extends Error {
  constructor(readonly issues: ReadonlyArray<StandardSchemaV1.Issue>) {
    super('Request validation failed');
  }
}

class BodyParsingFailure extends Error {
  constructor() {
    super('Request body could not be parsed');
  }
}

async function validate<Schema extends AnySchema>(
  schema: Schema,
  value: unknown,
): Promise<SchemaOutput<Schema>> {
  const result = await schema['~standard'].validate(value);

  if (result.issues) {
    throw new ValidationFailure(result.issues);
  }

  return result.value as SchemaOutput<Schema>;
}

function json(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

function badRequest(
  issues?: ReadonlyArray<StandardSchemaV1.Issue>,
): Response {
  return json(
    issues ? { error: 'Bad Request', issues } : { error: 'Bad Request' },
    400,
  );
}

function notFound(): Response {
  return json({ error: 'Not Found' }, 404);
}

function internalServerError(): Response {
  return json({ error: 'Internal Server Error' }, 500);
}

function response(
  body: unknown,
  status: number,
  headers?: HeadersInit,
): Response {
  const responseHeaders = new Headers(headers);

  if (body === undefined || body === null || status === 204 || status === 304) {
    return new Response(null, { status, headers: responseHeaders });
  }

  if (typeof body === 'string') {
    return new Response(body, { status, headers: responseHeaders });
  }

  if (
    body instanceof ReadableStream ||
    body instanceof Blob ||
    body instanceof ArrayBuffer ||
    ArrayBuffer.isView(body)
  ) {
    return new Response(body as BodyInit, {
      status,
      headers: responseHeaders,
    });
  }

  if (!responseHeaders.has('content-type')) {
    responseHeaders.set('content-type', 'application/json; charset=utf-8');
  }

  return new Response(JSON.stringify(body), {
    status,
    headers: responseHeaders,
  });
}

function requestHeaders(request: Request): Record<string, string> {
  return Object.fromEntries(
    [...request.headers.entries()].map(([key, value]) => [
      key.toLowerCase(),
      value,
    ]),
  );
}

function requestQuery(url: URL): Record<string, string | string[]> {
  const query: Record<string, string | string[]> = {};

  for (const [key, value] of url.searchParams) {
    const existing = query[key];

    if (existing === undefined) {
      query[key] = value;
    } else if (Array.isArray(existing)) {
      existing.push(value);
    } else {
      query[key] = [existing, value];
    }
  }

  return query;
}

function runMiddlewares(
  middlewares: Middleware[],
  request: Request,
  terminal: () => Promise<Response>,
): Promise<Response> {
  let next = terminal;

  for (let index = middlewares.length - 1; index >= 0; index -= 1) {
    const middleware = middlewares[index];
    const downstream = next;
    next = () => Promise.resolve(middleware(request, downstream));
  }

  return next();
}

export function createApp(): MizuApp {
  const routes: RegisteredRoute[] = [];
  const middlewares: Middleware[] = [];

  const app: MizuApp = {
    get<Contract extends GetContract>(
      path: string,
      contract: Contract,
      handler: GetHandler<Contract>,
    ): MizuApp {
      routes.push({
        method: 'GET',
        path,
        contract,
        handler: handler as (
          context: Record<string, unknown>,
        ) => unknown,
        middlewares: [],
      });

      return this;
    },

    post<Contract extends PostContract>(
      path: string,
      contract: Contract,
      handler: PostHandler<Contract>,
    ): MizuApp {
      routes.push({
        method: 'POST',
        path,
        contract,
        handler: handler as (
          context: Record<string, unknown>,
        ) => unknown,
        middlewares: [],
      });

      return this;
    },

    put<Contract extends PutContract>(
      path: string,
      contract: Contract,
      handler: PutHandler<Contract>,
    ): MizuApp {
      routes.push({
        method: 'PUT',
        path,
        contract,
        handler: handler as (context: Record<string, unknown>) => unknown,
        middlewares: [],
      });

      return this;
    },

    patch<Contract extends PatchContract>(
      path: string,
      contract: Contract,
      handler: PatchHandler<Contract>,
    ): MizuApp {
      routes.push({
        method: 'PATCH',
        path,
        contract,
        handler: handler as (context: Record<string, unknown>) => unknown,
        middlewares: [],
      });

      return this;
    },

    delete<Contract extends DeleteContract>(
      path: string,
      contract: Contract,
      handler: DeleteHandler<Contract>,
    ): MizuApp {
      routes.push({
        method: 'DELETE',
        path,
        contract,
        handler: handler as (context: Record<string, unknown>) => unknown,
        middlewares: [],
      });

      return this;
    },

    query<Contract extends QueryContract>(
      path: string,
      contract: Contract,
      handler: QueryHandler<Contract>,
    ): MizuApp {
      routes.push({
        method: 'QUERY',
        path,
        contract,
        handler: handler as (context: Record<string, unknown>) => unknown,
        middlewares: [],
      });

      return this;
    },

    use(middleware: Middleware): MizuApp {
      middlewares.push(middleware);
      return this;
    },

    route(prefix: string, router: MizuRouter): MizuApp {
      const internalRouter = router as InternalRouter;

      for (const definition of internalRouter.definitions) {
        routes.push({
          ...definition,
          path: joinPaths(prefix, definition.path),
          middlewares: [...internalRouter.middlewares],
        });
      }

      return this;
    },

    async fetch(request: Request): Promise<Response> {
      const url = new URL(request.url);
      const candidates = routes
        .filter((candidate) => candidate.method === request.method)
        .sort(
          (left, right) =>
            Number(isDynamicPath(left.path)) - Number(isDynamicPath(right.path)),
        );
      let route: RegisteredRoute | undefined;
      let params: Record<string, string> | null = null;

      for (const candidate of candidates) {
        const match = matchPath(candidate.path, url.pathname);
        if (match) {
          route = candidate;
          params = match;
          break;
        }
      }

      if (!route) {
        return notFound();
      }

      const dispatchRoute = async (): Promise<Response> => {
        const context: Record<string, unknown> = {};

        try {
          const requestSchemas = route.contract.request;

        if (params && Object.keys(params).length > 0) {
          context.params = requestSchemas?.params
            ? await validate(requestSchemas.params, params)
            : params;
        }

        const query = requestQuery(url);
        if (requestSchemas?.query) {
          context.query = await validate(requestSchemas.query, query);
        } else if (Object.keys(query).length > 0) {
          context.query = query;
        }

        if (requestSchemas?.headers) {
          context.headers = await validate(
            requestSchemas.headers,
            requestHeaders(request),
          );
        }

        if (requestSchemas?.body) {
          const contentType = request.headers.get('content-type');
          if (!contentType?.toLowerCase().startsWith('application/json')) {
            throw new BodyParsingFailure();
          }

          let body: unknown;
          try {
            body = await request.json();
          } catch {
            throw new BodyParsingFailure();
          }

          context.body = await validate(requestSchemas.body, body);
        }

        } catch (error) {
          if (error instanceof ValidationFailure) {
            return badRequest(error.issues);
          }

          if (error instanceof BodyParsingFailure) {
            return badRequest();
          }

          return internalServerError();
        }

        let result: { status: number; body: unknown; headers?: HeadersInit };
        try {
          result = (await route.handler(context)) as {
            status: number;
            body: unknown;
            headers?: HeadersInit;
          };
        } catch {
          return internalServerError();
        }

        let body = result.body;
        if (route.contract.response) {
          const responseSchema = route.contract.response[result.status];
          if (!responseSchema) {
            return internalServerError();
          }

          try {
            body = await validate(responseSchema, result.body);
          } catch {
            return internalServerError();
          }
        }

        return response(body, result.status, result.headers);
      };

      return runMiddlewares(route.middlewares, request, dispatchRoute);
    },
  };

  const dispatch = app.fetch;
  app.fetch = async (request: Request): Promise<Response> => {
    return runMiddlewares(middlewares, request, () => dispatch(request));
  };

  return app;
}

export function createRouter(): MizuRouter {
  const definitions: RouteDefinition[] = [];
  const middlewares: Middleware[] = [];

  const router: InternalRouter = {
    get<Contract extends GetContract>(
      path: string,
      contract: Contract,
      handler: GetHandler<Contract>,
    ): MizuRouter {
      definitions.push(
        routeDefinition(
          'GET',
          path,
          contract,
          handler as (context: Record<string, unknown>) => unknown,
        ),
      );
      return router;
    },

    post<Contract extends PostContract>(
      path: string,
      contract: Contract,
      handler: PostHandler<Contract>,
    ): MizuRouter {
      definitions.push(
        routeDefinition(
          'POST',
          path,
          contract,
          handler as (context: Record<string, unknown>) => unknown,
        ),
      );
      return router;
    },

    put<Contract extends PutContract>(
      path: string,
      contract: Contract,
      handler: PutHandler<Contract>,
    ): MizuRouter {
      definitions.push(
        routeDefinition(
          'PUT',
          path,
          contract,
          handler as (context: Record<string, unknown>) => unknown,
        ),
      );
      return router;
    },

    patch<Contract extends PatchContract>(
      path: string,
      contract: Contract,
      handler: PatchHandler<Contract>,
    ): MizuRouter {
      definitions.push(
        routeDefinition(
          'PATCH',
          path,
          contract,
          handler as (context: Record<string, unknown>) => unknown,
        ),
      );
      return router;
    },

    delete<Contract extends DeleteContract>(
      path: string,
      contract: Contract,
      handler: DeleteHandler<Contract>,
    ): MizuRouter {
      definitions.push(
        routeDefinition(
          'DELETE',
          path,
          contract,
          handler as (context: Record<string, unknown>) => unknown,
        ),
      );
      return router;
    },

    query<Contract extends QueryContract>(
      path: string,
      contract: Contract,
      handler: QueryHandler<Contract>,
    ): MizuRouter {
      definitions.push(
        routeDefinition(
          'QUERY',
          path,
          contract,
          handler as (context: Record<string, unknown>) => unknown,
        ),
      );
      return router;
    },

    use(middleware: Middleware): MizuRouter {
      middlewares.push(middleware);
      return router;
    },

    definitions,
    middlewares,
  };

  return router;
}
