import type { Context, GetHandler, Middleware, MizuApp } from '../src/types.js';
import { expect, test } from 'vitest';

const asyncHandler: GetHandler<{}> = async () => ({
  status: 200,
  body: 'ok',
});

const asyncMiddleware: Middleware = async (_request, next) => next();

const contextHandler: GetHandler<{}> = async ({ ctx }) => {
  const context: Context = ctx;
  context.header('x-test', 'ok');
  context.set('value', 'typed');
  return context.text(context.get('value'));
};

const requestHelper: MizuApp['request'] = (input, init) =>
  Promise.resolve(new Response(`${String(input)}${init?.method ?? ''}`));

// @ts-expect-error synchronous handlers are no longer accepted
const syncHandler: GetHandler<{}> = () => ({
  status: 200,
  body: 'ok',
});

// @ts-expect-error synchronous middleware is no longer accepted
const syncMiddleware: Middleware = (_request, _next) => new Response('ok');

void asyncHandler;
void asyncMiddleware;
void contextHandler;
void requestHelper;
void syncHandler;
void syncMiddleware;

test('async-only public types compile', () => {
  expect(true).toBe(true);
});
