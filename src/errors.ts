export class HttpError<Body = unknown> extends Error {
  readonly status: number;
  readonly body: Body;
  readonly headers?: HeadersInit;

  constructor(status: number, body: Body, headers?: HeadersInit) {
    super(`HTTP error ${status}`);
    this.name = 'HttpError';
    this.status = status;
    this.body = body;
    this.headers = headers;
  }
}
