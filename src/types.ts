import type { StandardSchemaV1 } from '@standard-schema/spec';
import type { Context } from './context.js';

export type { Context, ContextVariables } from './context.js';

export type AnySchema = StandardSchemaV1<any, any>;

export type SchemaOutput<Schema extends AnySchema> =
  StandardSchemaV1.InferOutput<Schema>;

export type RequestSchemas = {
  headers?: AnySchema;
  params?: AnySchema;
  query?: AnySchema;
  body?: AnySchema;
};

export type ResponseSchemas = Record<number, AnySchema>;

export type RouteContract = {
  request?: RequestSchemas;
  response?: ResponseSchemas;
};

export type GetContract = {
  request?: Pick<RequestSchemas, 'headers' | 'params' | 'query'>;
  response?: ResponseSchemas;
};

type OutputContext<Schemas extends RequestSchemas | undefined> = {
  [Key in keyof Schemas]: Schemas[Key] extends AnySchema
    ? SchemaOutput<Schemas[Key]>
    : never;
};

export type GetContext<Contract extends GetContract> = OutputContext<
  Contract['request']
> & { ctx: Context };

export type ResponseData<Body = unknown> = {
  status: number;
  body: Body;
  headers?: HeadersInit;
};

export type ErrorHandlerResult = ResponseData | Response;
export type ErrorHandler = (
  error: unknown,
  context: Context,
) => Promise<ErrorHandlerResult>;
export type NotFoundHandler = (
  context: Context,
) => Promise<ErrorHandlerResult>;

type ResponseBody<Schemas extends ResponseSchemas | undefined> =
  Schemas extends ResponseSchemas
    ? SchemaOutput<Extract<Schemas[keyof Schemas], AnySchema>>
    : unknown;

export type GetResponse<Contract extends GetContract> =
  ResponseData<ResponseBody<Contract['response']>>;

export type Middleware = (
  request: Request,
  next: (request?: Request) => Promise<Response>,
  context?: Context,
) => Promise<Response>;

export type GetHandler<Contract extends GetContract> = (
  context: GetContext<Contract>,
) => Promise<GetResponse<Contract>>;

export type PostContract = {
  request?: RequestSchemas;
  response?: ResponseSchemas;
};

export type PostContext<Contract extends PostContract> = OutputContext<
  Contract['request']
> & { ctx: Context };

export type PostResponse<Contract extends PostContract> =
  ResponseData<ResponseBody<Contract['response']>>;

export type PostHandler<Contract extends PostContract> = (
  context: PostContext<Contract>,
) => Promise<PostResponse<Contract>>;

export type PutContract = PostContract;
export type PutHandler<Contract extends PutContract> = PostHandler<Contract>;
export type PatchContract = PostContract;
export type PatchHandler<Contract extends PatchContract> =
  PostHandler<Contract>;
export type DeleteContract = PostContract;
export type DeleteHandler<Contract extends DeleteContract> =
  PostHandler<Contract>;
export type QueryContract = PostContract;
export type QueryHandler<Contract extends QueryContract> =
  PostHandler<Contract>;
export type HeadContract = GetContract;
export type HeadHandler<Contract extends HeadContract> = GetHandler<Contract>;
export type OptionsContract = PostContract;
export type OptionsHandler<Contract extends OptionsContract> =
  PostHandler<Contract>;

export type MizuRouter = {
  get<Contract extends GetContract>(
    path: string,
    contract: Contract,
    handler: GetHandler<Contract>,
    ...middlewares: Middleware[]
  ): MizuRouter;
  post<Contract extends PostContract>(
    path: string,
    contract: Contract,
    handler: PostHandler<Contract>,
    ...middlewares: Middleware[]
  ): MizuRouter;
  put<Contract extends PutContract>(
    path: string,
    contract: Contract,
    handler: PutHandler<Contract>,
    ...middlewares: Middleware[]
  ): MizuRouter;
  patch<Contract extends PatchContract>(
    path: string,
    contract: Contract,
    handler: PatchHandler<Contract>,
    ...middlewares: Middleware[]
  ): MizuRouter;
  delete<Contract extends DeleteContract>(
    path: string,
    contract: Contract,
    handler: DeleteHandler<Contract>,
    ...middlewares: Middleware[]
  ): MizuRouter;
  query<Contract extends QueryContract>(
    path: string,
    contract: Contract,
    handler: QueryHandler<Contract>,
    ...middlewares: Middleware[]
  ): MizuRouter;
  head<Contract extends HeadContract>(
    path: string,
    contract: Contract,
    handler: HeadHandler<Contract>,
    ...middlewares: Middleware[]
  ): MizuRouter;
  options<Contract extends OptionsContract>(
    path: string,
    contract: Contract,
    handler: OptionsHandler<Contract>,
    ...middlewares: Middleware[]
  ): MizuRouter;
  use(middleware: Middleware): MizuRouter;
  use(path: string, middleware: Middleware): MizuRouter;
};

export type MizuApp = MizuRouter & {
  route(prefix: string, router: MizuRouter): MizuApp;
  fetch(request: Request): Promise<Response>;
  request(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
  onError(handler: ErrorHandler): MizuApp;
  notFound(handler: NotFoundHandler): MizuApp;
};
