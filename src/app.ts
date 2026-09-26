import type { StandardSchemaV1 } from '@standard-schema/spec';
import type {
  AnySchema,
  HeadContract,
  HeadHandler,
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
  OptionsContract,
  OptionsHandler,
  RouteContract,
  SchemaOutput,
} from './types.js';

type RouteDefinition = {
  method: string;
  path: string;
  contract: RouteContract;
  handler: (context: Record<string, unknown>) => unknown;
  middlewares: Middleware[];
};

type RouteMatcher = (pathname: string) => Record<string, string> | null;
type MiddlewareRunner = (
  request: Request,
  terminal: () => Promise<Response>,
) => Promise<Response>;
type ResponseValidator = (status: number, body: unknown) => Promise<unknown>;

type RegisteredRoute = RouteDefinition & {
  matcher: RouteMatcher | null;
  paramNames: string[];
  segments: string[];
  segmentKinds: boolean[];
  middlewareRunner: MiddlewareRunner;
  responseValidator: ResponseValidator | null;
};

type DynamicRouteNode = {
  staticChildren: Map<string, DynamicRouteNode>;
  paramChild?: DynamicRouteNode;
  route?: RegisteredRoute;
};

type DynamicRouteIndex = {
  routes: RegisteredRoute[];
  trie: DynamicRouteNode;
  staticSuffix: Map<string, RegisteredRoute[]>;
};

type RouteTable = {
  static: Map<string, RegisteredRoute>;
  dynamic: Map<string, DynamicRouteIndex>;
};

const DYNAMIC_TRIE_THRESHOLD = 512;

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
  middlewares: Middleware[] = [],
): RouteDefinition {
  return { method, path, contract, handler, middlewares };
}

function isDynamicPath(path: string): boolean {
  return path
    .split('/')
    .some((segment) => segment.startsWith(':') || segment === '*');
}

function createDynamicRouteNode(): DynamicRouteNode {
  return { staticChildren: new Map() };
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function dynamicParamNames(path: string): string[] {
  return path
    .split('/')
    .filter((segment) => segment.startsWith(':') || segment === '*')
    .map((segment) => segment === '*' ? '*' : segment.slice(1));
}

function routeSegmentKinds(path: string): boolean[] {
  return path
    .split('/')
    .map((segment) => !segment.startsWith(':') && segment !== '*');
}

function compareRouteSpecificity(
  left: RegisteredRoute,
  right: RegisteredRoute,
): number {
  const length = Math.min(left.segmentKinds.length, right.segmentKinds.length);
  for (let index = 0; index < length; index += 1) {
    if (left.segmentKinds[index] !== right.segmentKinds[index]) {
      return left.segmentKinds[index] ? -1 : 1;
    }
  }
  return 0;
}

function insertSpecificRoute(
  routes: RegisteredRoute[],
  route: RegisteredRoute,
): void {
  const insertionIndex = routes.findIndex(
    (candidate) => compareRouteSpecificity(route, candidate) < 0,
  );
  if (insertionIndex === -1) {
    routes.push(route);
  } else {
    routes.splice(insertionIndex, 0, route);
  }
}

function createRouteMatcher(path: string): RouteMatcher {
  const segments = path.split('/');
  const wildcardIndex = segments.findIndex((segment) => segment === '*');

  if (wildcardIndex === segments.length - 1) {
    const prefix = `${segments.slice(0, wildcardIndex).join('/')}/`;

    return (pathname) => {
      if (!pathname.startsWith(prefix)) return null;

      return { '*': decodeURIComponent(pathname.slice(prefix.length)) };
    };
  }

  const paramNames = segments
    .filter((segment) => segment.startsWith(':'))
    .map((segment) => segment.slice(1));

  if (paramNames.length === 1) {
    const paramIndex = segments.findIndex((segment) => segment.startsWith(':'));
    const prefix = `${segments.slice(0, paramIndex).join('/')}/`;
    const suffixSegments = segments.slice(paramIndex + 1);
    const suffix = suffixSegments.length > 0
      ? `/${suffixSegments.join('/')}`
      : '';
    const paramName = paramNames[0];

    return (pathname) => {
      if (!pathname.startsWith(prefix) || !pathname.endsWith(suffix)) {
        return null;
      }

      const end = suffix ? pathname.length - suffix.length : pathname.length;
      const value = pathname.slice(prefix.length, end);
      if (value.includes('/')) return null;

      return { [paramName]: decodeURIComponent(value) };
    };
  }

  if (paramNames.length === 2) {
    const firstParamIndex = segments.findIndex((segment) => segment.startsWith(':'));
    const secondParamIndex = segments.findIndex(
      (segment, index) => index > firstParamIndex && segment.startsWith(':'),
    );
    const prefix = `${segments.slice(0, firstParamIndex).join('/')}/`;
    const middleSegments = segments.slice(firstParamIndex + 1, secondParamIndex);
    const middle = middleSegments.length > 0
      ? `/${middleSegments.join('/')}/`
      : '/';
    const suffixSegments = segments.slice(secondParamIndex + 1);
    const suffix = suffixSegments.length > 0
      ? `/${suffixSegments.join('/')}`
      : '';
    const [firstParamName, secondParamName] = paramNames;

    return (pathname) => {
      if (!pathname.startsWith(prefix) || !pathname.endsWith(suffix)) {
        return null;
      }

      const middleStart = pathname.indexOf(middle, prefix.length);
      if (middleStart === -1) return null;

      const end = suffix ? pathname.length - suffix.length : pathname.length;
      const firstValue = pathname.slice(prefix.length, middleStart);
      const secondValue = pathname.slice(
        middleStart + middle.length,
        end,
      );
      if (firstValue.includes('/') || secondValue.includes('/')) return null;

      return {
        [firstParamName]: decodeURIComponent(firstValue),
        [secondParamName]: decodeURIComponent(secondValue),
      };
    };
  }

  if (paramNames.length === 3) {
    const paramIndices = segments
      .map((segment, index) => segment.startsWith(':') ? index : -1)
      .filter((index) => index >= 0);
    const prefix = `${segments.slice(0, paramIndices[0]).join('/')}/`;
    const separators = paramIndices.slice(0, -1).map((paramIndex, index) => {
      const nextParamIndex = paramIndices[index + 1];
      const middleSegments = segments.slice(paramIndex + 1, nextParamIndex);
      return middleSegments.length > 0
        ? `/${middleSegments.join('/')}/`
        : '/';
    });
    const suffixSegments = segments.slice(paramIndices[2] + 1);
    const suffix = suffixSegments.length > 0
      ? `/${suffixSegments.join('/')}`
      : '';

    return (pathname) => {
      if (!pathname.startsWith(prefix) || !pathname.endsWith(suffix)) {
        return null;
      }

      const end = suffix ? pathname.length - suffix.length : pathname.length;
      const values: string[] = [];
      let cursor = prefix.length;
      for (const separator of separators) {
        const separatorIndex = pathname.indexOf(separator, cursor);
        if (separatorIndex === -1) return null;
        const value = pathname.slice(cursor, separatorIndex);
        if (value.includes('/')) return null;
        values.push(value);
        cursor = separatorIndex + separator.length;
      }

      const lastValue = pathname.slice(cursor, end);
      if (lastValue.includes('/')) return null;
      values.push(lastValue);

      return {
        [paramNames[0]]: decodeURIComponent(values[0]),
        [paramNames[1]]: decodeURIComponent(values[1]),
        [paramNames[2]]: decodeURIComponent(values[2]),
      };
    };
  }

  return (pathname) => {
    const pathnameSegments = pathname.split('/');
    if (pathnameSegments.length !== segments.length) return null;

    const params: Record<string, string> = {};
    let paramIndex = 0;
    for (let index = 0; index < segments.length; index += 1) {
      const routeSegment = segments[index];
      if (routeSegment.startsWith(':')) {
        params[paramNames[paramIndex]] = decodeURIComponent(
          pathnameSegments[index],
        );
        paramIndex += 1;
      } else if (routeSegment !== pathnameSegments[index]) {
        return null;
      }
    }

    return params;
  };
}

function findCompiledRoute(
  index: DynamicRouteIndex,
  pathname: string,
): { route: RegisteredRoute; params: Record<string, string> } | null {
  const lastSlash = pathname.lastIndexOf('/');
  const suffixCandidates = index.staticSuffix.get(
    pathname.slice(lastSlash + 1),
  );
  const candidates = suffixCandidates ?? index.routes;

  for (const route of candidates) {
    const params = route.matcher?.(pathname) ?? null;
    if (params) return { route, params };
  }

  return null;
}

function findDynamicRoute(
  root: DynamicRouteNode,
  pathname: string,
): { route: RegisteredRoute; params: Record<string, string> } | null {
  const segments = pathname.split('/');

  const visit = (
    node: DynamicRouteNode,
    index: number,
    values: string[],
  ): { route: RegisteredRoute; values: string[] } | null => {
    if (index === segments.length) {
      return node.route ? { route: node.route, values } : null;
    }

    const staticChild = node.staticChildren.get(segments[index]);
    if (staticChild) {
      const match = visit(staticChild, index + 1, values);
      if (match) return match;
    }

    if (node.paramChild) {
      values.push(segments[index]);
      const match = visit(node.paramChild, index + 1, values);
      if (match) return match;
      values.pop();
    }

    return null;
  };

  const match = visit(root, 0, []);
  if (!match) return null;

  const params: Record<string, string> = {};
  for (let index = 0; index < match.route.paramNames.length; index += 1) {
    params[match.route.paramNames[index]] = decodeURIComponent(match.values[index]);
  }

  return { route: match.route, params };
}

function findRoute(
  table: RouteTable,
  method: string,
  pathname: string,
): { route: RegisteredRoute; params: Record<string, string> | null } | null {
  const staticRoute = table.static.get(`${method} ${pathname}`);
  if (staticRoute) return { route: staticRoute, params: null };

  const dynamicIndex = table.dynamic.get(method);
  if (!dynamicIndex) return null;

  const hasWildcard = dynamicIndex.routes.some((route) =>
    route.segments.includes('*'),
  );

  return dynamicIndex.routes.length > DYNAMIC_TRIE_THRESHOLD && !hasWildcard
    ? findDynamicRoute(dynamicIndex.trie, pathname)
    : findCompiledRoute(dynamicIndex, pathname);
}

function allowedMethods(table: RouteTable, pathname: string): string[] {
  const methods = new Set<string>();
  for (const method of new Set([
    ...[...table.static.keys()].map((key) => key.slice(0, key.indexOf(' '))),
    ...table.dynamic.keys(),
  ])) {
    if (findRoute(table, method, pathname)) methods.add(method);
  }

  if (methods.has('GET')) methods.add('HEAD');
  if (methods.size > 0) methods.add('OPTIONS');

  return [...methods].sort();
}

function registerRoute(table: RouteTable, definition: RouteDefinition): void {
  const isStatic = !isDynamicPath(definition.path);
  const route: RegisteredRoute = {
    ...definition,
    matcher: isStatic ? null : createRouteMatcher(definition.path),
    paramNames: dynamicParamNames(definition.path),
    segments: definition.path.split('/'),
    segmentKinds: routeSegmentKinds(definition.path),
    middlewareRunner: createMiddlewareRunner(definition.middlewares),
    responseValidator: createResponseValidator(definition.contract.response),
  };

  if (isStatic) {
    const key = `${route.method} ${route.path}`;
    if (!table.static.has(key)) table.static.set(key, route);
  } else {
    let index = table.dynamic.get(route.method);
    if (!index) {
      index = {
        routes: [],
        trie: createDynamicRouteNode(),
        staticSuffix: new Map(),
      };
      table.dynamic.set(route.method, index);
    }

    insertSpecificRoute(index.routes, route);

    const finalSegment = route.segments[route.segments.length - 1];
    if (!finalSegment.startsWith(':')) {
      let candidates = index.staticSuffix.get(finalSegment);
      if (!candidates) {
        candidates = [];
        index.staticSuffix.set(finalSegment, candidates);
      }
      insertSpecificRoute(candidates, route);
    }

    let node = index.trie;
    for (const segment of route.path.split('/')) {
      if (segment.startsWith(':')) {
        node.paramChild ??= createDynamicRouteNode();
        node = node.paramChild;
      } else {
        let child = node.staticChildren.get(segment);
        if (!child) {
          child = createDynamicRouteNode();
          node.staticChildren.set(segment, child);
        }
        node = child;
      }
    }

    node.route ??= route;
  }
}

function createResponseValidator(
  schemas: RouteContract['response'],
): ResponseValidator | null {
  if (!schemas) return null;

  return async (status, body) => {
    const schema = schemas[status];
    if (!schema) throw new Error('Response schema not found');
    return validate(schema, body);
  };
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
  head = false,
): Response {
  const responseHeaders = new Headers(headers);

  if (body === undefined || body === null || status === 204 || status === 304) {
    return new Response(null, { status, headers: responseHeaders });
  }

  let result: Response;

  if (typeof body === 'string') {
    result = new Response(body, { status, headers: responseHeaders });
  } else if (
    body instanceof ReadableStream ||
    body instanceof Blob ||
    body instanceof ArrayBuffer ||
    ArrayBuffer.isView(body)
  ) {
    result = new Response(body as BodyInit, {
      status,
      headers: responseHeaders,
    });
  } else {
    if (!responseHeaders.has('content-type')) {
      responseHeaders.set('content-type', 'application/json; charset=utf-8');
    }

    result = new Response(JSON.stringify(body), {
      status,
      headers: responseHeaders,
    });
  }

  return head
    ? new Response(null, { status: result.status, headers: result.headers })
    : result;
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

function createMiddlewareRunner(middlewares: Middleware[]): MiddlewareRunner {
  let runner: MiddlewareRunner = (_request, terminal) => terminal();

  for (let index = middlewares.length - 1; index >= 0; index -= 1) {
    const middleware = middlewares[index];
    const downstream = runner;
    runner = (request, terminal) =>
      Promise.resolve(
        middleware(request, () => downstream(request, terminal)),
      );
  }

  return runner;
}

function createRouteTable(): RouteTable {
  return { static: new Map(), dynamic: new Map() };
}

export function createApp(): MizuApp {
  const routeTable = createRouteTable();
  const middlewares: Middleware[] = [];
  let middlewareRunner = createMiddlewareRunner(middlewares);
  const addRoute = (definition: RouteDefinition): void => {
    registerRoute(routeTable, definition);
  };

  const app: MizuApp = {
    get<Contract extends GetContract>(
      path: string,
      contract: Contract,
      handler: GetHandler<Contract>,
      ...routeMiddlewares: Middleware[]
    ): MizuApp {
      addRoute({
        method: 'GET',
        path,
        contract,
        handler: handler as (
          context: Record<string, unknown>,
        ) => unknown,
        middlewares: routeMiddlewares,
      });

      return this;
    },

    post<Contract extends PostContract>(
      path: string,
      contract: Contract,
      handler: PostHandler<Contract>,
      ...routeMiddlewares: Middleware[]
    ): MizuApp {
      addRoute({
        method: 'POST',
        path,
        contract,
        handler: handler as (
          context: Record<string, unknown>,
        ) => unknown,
        middlewares: routeMiddlewares,
      });

      return this;
    },

    put<Contract extends PutContract>(
      path: string,
      contract: Contract,
      handler: PutHandler<Contract>,
      ...routeMiddlewares: Middleware[]
    ): MizuApp {
      addRoute({
        method: 'PUT',
        path,
        contract,
        handler: handler as (context: Record<string, unknown>) => unknown,
        middlewares: routeMiddlewares,
      });

      return this;
    },

    patch<Contract extends PatchContract>(
      path: string,
      contract: Contract,
      handler: PatchHandler<Contract>,
      ...routeMiddlewares: Middleware[]
    ): MizuApp {
      addRoute({
        method: 'PATCH',
        path,
        contract,
        handler: handler as (context: Record<string, unknown>) => unknown,
        middlewares: routeMiddlewares,
      });

      return this;
    },

    delete<Contract extends DeleteContract>(
      path: string,
      contract: Contract,
      handler: DeleteHandler<Contract>,
      ...routeMiddlewares: Middleware[]
    ): MizuApp {
      addRoute({
        method: 'DELETE',
        path,
        contract,
        handler: handler as (context: Record<string, unknown>) => unknown,
        middlewares: routeMiddlewares,
      });

      return this;
    },

    query<Contract extends QueryContract>(
      path: string,
      contract: Contract,
      handler: QueryHandler<Contract>,
      ...routeMiddlewares: Middleware[]
    ): MizuApp {
      addRoute({
        method: 'QUERY',
        path,
        contract,
        handler: handler as (context: Record<string, unknown>) => unknown,
        middlewares: routeMiddlewares,
      });

      return this;
    },

    head<Contract extends HeadContract>(
      path: string,
      contract: Contract,
      handler: HeadHandler<Contract>,
      ...routeMiddlewares: Middleware[]
    ): MizuApp {
      addRoute({
        method: 'HEAD',
        path,
        contract,
        handler: handler as (context: Record<string, unknown>) => unknown,
        middlewares: routeMiddlewares,
      });

      return this;
    },

    options<Contract extends OptionsContract>(
      path: string,
      contract: Contract,
      handler: OptionsHandler<Contract>,
      ...routeMiddlewares: Middleware[]
    ): MizuApp {
      addRoute({
        method: 'OPTIONS',
        path,
        contract,
        handler: handler as (context: Record<string, unknown>) => unknown,
        middlewares: routeMiddlewares,
      });

      return this;
    },

    use(middleware: Middleware): MizuApp {
      middlewares.push(middleware);
      middlewareRunner = createMiddlewareRunner(middlewares);
      return this;
    },

    route(prefix: string, router: MizuRouter): MizuApp {
      const internalRouter = router as InternalRouter;

      for (const definition of internalRouter.definitions) {
        addRoute({
          ...definition,
          path: joinPaths(prefix, definition.path),
          middlewares: [
            ...internalRouter.middlewares,
            ...definition.middlewares,
          ],
        });
      }

      return this;
    },

    async fetch(request: Request): Promise<Response> {
      const url = new URL(request.url);
      let method = request.method;
      let match = findRoute(routeTable, method, url.pathname);
      let headResponse = method === 'HEAD';

      if (!match && method === 'HEAD') {
        match = findRoute(routeTable, 'GET', url.pathname);
      }

      if (!match) {
        const methods = allowedMethods(routeTable, url.pathname);
        if (method === 'OPTIONS' && methods.length > 0) {
          return new Response(null, {
            status: 204,
            headers: { allow: methods.join(', ') },
          });
        }

        if (methods.length > 0) {
          return new Response(null, {
            status: 405,
            headers: { allow: methods.join(', ') },
          });
        }

        return notFound();
      }

      const route = match.route;
      const params = match.params;

      const dispatchRoute = async (): Promise<Response> => {
        const context: Record<string, unknown> = {};

        try {
          const requestSchemas = route.contract.request;

        if (params && Object.keys(params).length > 0) {
          context.params = requestSchemas?.params
            ? await validate(requestSchemas.params, params)
            : params;
        }

        const query = requestSchemas?.query || url.search
          ? requestQuery(url)
          : undefined;
        if (requestSchemas?.query) {
          context.query = await validate(requestSchemas.query, query);
        } else if (query && Object.keys(query).length > 0) {
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
        if (route.responseValidator) {
          try {
            body = await route.responseValidator(result.status, result.body);
          } catch {
            return internalServerError();
          }
        }

        return response(body, result.status, result.headers, headResponse);
      };

      return route.middlewareRunner(request, dispatchRoute);
    },
  };

  const dispatch = app.fetch;
  app.fetch = async (request: Request): Promise<Response> => {
    return middlewareRunner(request, () => dispatch(request));
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
      ...routeMiddlewares: Middleware[]
    ): MizuRouter {
      definitions.push(
        routeDefinition(
          'GET',
          path,
          contract,
          handler as (context: Record<string, unknown>) => unknown,
          routeMiddlewares,
        ),
      );
      return router;
    },

    post<Contract extends PostContract>(
      path: string,
      contract: Contract,
      handler: PostHandler<Contract>,
      ...routeMiddlewares: Middleware[]
    ): MizuRouter {
      definitions.push(
        routeDefinition(
          'POST',
          path,
          contract,
          handler as (context: Record<string, unknown>) => unknown,
          routeMiddlewares,
        ),
      );
      return router;
    },

    put<Contract extends PutContract>(
      path: string,
      contract: Contract,
      handler: PutHandler<Contract>,
      ...routeMiddlewares: Middleware[]
    ): MizuRouter {
      definitions.push(
        routeDefinition(
          'PUT',
          path,
          contract,
          handler as (context: Record<string, unknown>) => unknown,
          routeMiddlewares,
        ),
      );
      return router;
    },

    patch<Contract extends PatchContract>(
      path: string,
      contract: Contract,
      handler: PatchHandler<Contract>,
      ...routeMiddlewares: Middleware[]
    ): MizuRouter {
      definitions.push(
        routeDefinition(
          'PATCH',
          path,
          contract,
          handler as (context: Record<string, unknown>) => unknown,
          routeMiddlewares,
        ),
      );
      return router;
    },

    delete<Contract extends DeleteContract>(
      path: string,
      contract: Contract,
      handler: DeleteHandler<Contract>,
      ...routeMiddlewares: Middleware[]
    ): MizuRouter {
      definitions.push(
        routeDefinition(
          'DELETE',
          path,
          contract,
          handler as (context: Record<string, unknown>) => unknown,
          routeMiddlewares,
        ),
      );
      return router;
    },

    query<Contract extends QueryContract>(
      path: string,
      contract: Contract,
      handler: QueryHandler<Contract>,
      ...routeMiddlewares: Middleware[]
    ): MizuRouter {
      definitions.push(
        routeDefinition(
          'QUERY',
          path,
          contract,
          handler as (context: Record<string, unknown>) => unknown,
          routeMiddlewares,
        ),
      );
      return router;
    },

    head<Contract extends HeadContract>(
      path: string,
      contract: Contract,
      handler: HeadHandler<Contract>,
      ...routeMiddlewares: Middleware[]
    ): MizuRouter {
      definitions.push(
        routeDefinition(
          'HEAD',
          path,
          contract,
          handler as (context: Record<string, unknown>) => unknown,
          routeMiddlewares,
        ),
      );
      return router;
    },

    options<Contract extends OptionsContract>(
      path: string,
      contract: Contract,
      handler: OptionsHandler<Contract>,
      ...routeMiddlewares: Middleware[]
    ): MizuRouter {
      definitions.push(
        routeDefinition(
          'OPTIONS',
          path,
          contract,
          handler as (context: Record<string, unknown>) => unknown,
          routeMiddlewares,
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
