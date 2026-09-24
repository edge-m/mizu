import type { StandardSchemaV1 } from '@standard-schema/spec';

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
>;

type ResponseBody<Schemas extends ResponseSchemas | undefined> =
  Schemas extends ResponseSchemas
    ? SchemaOutput<Extract<Schemas[keyof Schemas], AnySchema>>
    : unknown;

export type GetResponse<Contract extends GetContract> =
  {
    status: number;
    body: ResponseBody<Contract['response']>;
    headers?: HeadersInit;
  };

export type MaybePromise<Value> = Value | Promise<Value>;

export type Middleware = (
  request: Request,
  next: () => Promise<Response>,
) => MaybePromise<Response>;

export type GetHandler<Contract extends GetContract> = (
  context: GetContext<Contract>,
) => MaybePromise<GetResponse<Contract>>;

export type PostContract = {
  request?: RequestSchemas;
  response?: ResponseSchemas;
};

export type PostContext<Contract extends PostContract> = OutputContext<
  Contract['request']
>;

export type PostResponse<Contract extends PostContract> = {
  status: number;
  body: ResponseBody<Contract['response']>;
  headers?: HeadersInit;
};

export type PostHandler<Contract extends PostContract> = (
  context: PostContext<Contract>,
) => MaybePromise<PostResponse<Contract>>;

export type MizuRouter = {
  get<Contract extends GetContract>(
    path: string,
    contract: Contract,
    handler: GetHandler<Contract>,
  ): MizuRouter;
  post<Contract extends PostContract>(
    path: string,
    contract: Contract,
    handler: PostHandler<Contract>,
  ): MizuRouter;
  use(middleware: Middleware): MizuRouter;
};

export type MizuApp = MizuRouter & {
  route(prefix: string, router: MizuRouter): MizuApp;
  fetch(request: Request): Promise<Response>;
};
