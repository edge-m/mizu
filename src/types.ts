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
  request?: Pick<RequestSchemas, 'headers'>;
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
  { status: number; body: ResponseBody<Contract['response']> };

export type MaybePromise<Value> = Value | Promise<Value>;

export type GetHandler<Contract extends GetContract> = (
  context: GetContext<Contract>,
) => MaybePromise<GetResponse<Contract>>;

export type MizuApp = {
  get<Contract extends GetContract>(
    path: string,
    contract: Contract,
    handler: GetHandler<Contract>,
  ): MizuApp;
  fetch(request: Request): Promise<Response>;
};
