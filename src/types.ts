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

export type Middleware = (
  request: Request,
  next: () => Promise<Response>,
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
>;

export type PostResponse<Contract extends PostContract> = {
  status: number;
  body: ResponseBody<Contract['response']>;
  headers?: HeadersInit;
};

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
};

export type MizuApp = MizuRouter & {
  route(prefix: string, router: MizuRouter): MizuApp;
  fetch(request: Request): Promise<Response>;
};
