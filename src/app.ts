import type { StandardSchemaV1 } from '@standard-schema/spec';
import type {
  AnySchema,
  GetContract,
  GetHandler,
  MizuApp,
  RouteContract,
  SchemaOutput,
} from './types.js';

type RegisteredRoute = {
  method: string;
  path: string;
  contract: RouteContract;
  handler: (context: Record<string, unknown>) => unknown;
};

class ValidationFailure extends Error {
  constructor(readonly issues: ReadonlyArray<StandardSchemaV1.Issue>) {
    super('Request validation failed');
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

function requestHeaders(request: Request): Record<string, string> {
  return Object.fromEntries(
    [...request.headers.entries()].map(([key, value]) => [
      key.toLowerCase(),
      value,
    ]),
  );
}

export function createApp(): MizuApp {
  const routes: RegisteredRoute[] = [];

  return {
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
      });

      return this;
    },

    async fetch(request: Request): Promise<Response> {
      const url = new URL(request.url);
      const route = routes.find(
        (candidate) =>
          candidate.method === request.method && candidate.path === url.pathname,
      );

      if (!route) {
        return json({ error: 'Not Found' }, 404);
      }

      try {
        const context: Record<string, unknown> = {};
        const requestSchemas = route.contract.request;

        if (requestSchemas?.headers) {
          context.headers = await validate(
            requestSchemas.headers,
            requestHeaders(request),
          );
        }

        const result = (await route.handler(context)) as {
          status: number;
          body: unknown;
        };
        const responseSchema = route.contract.response?.[result.status];
        const body = responseSchema
          ? await validate(responseSchema, result.body)
          : result.body;

        return json(body, result.status);
      } catch (error) {
        if (error instanceof ValidationFailure) {
          return json(
            {
              error: 'Bad Request',
              issues: error.issues,
            },
            400,
          );
        }

        return json({ error: 'Internal Server Error' }, 500);
      }
    },
  };
}
