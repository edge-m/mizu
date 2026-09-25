import type { GetHandler, Middleware } from '../src/types.js';
import { expect, test } from 'vitest';

const asyncHandler: GetHandler<{}> = async () => ({
  status: 200,
  body: 'ok',
});

const asyncMiddleware: Middleware = async (_request, next) => next();

// @ts-expect-error synchronous handlers are no longer accepted
const syncHandler: GetHandler<{}> = () => ({
  status: 200,
  body: 'ok',
});

// @ts-expect-error synchronous middleware is no longer accepted
const syncMiddleware: Middleware = (_request, _next) => new Response('ok');

void asyncHandler;
void asyncMiddleware;
void syncHandler;
void syncMiddleware;

test('async-only public types compile', () => {
  expect(true).toBe(true);
});
