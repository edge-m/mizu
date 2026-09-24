import type { MizuApp } from './types.js';

export type WorkerHandler = (request: Request) => Promise<Response>;

export function createWorkerHandler(app: MizuApp): WorkerHandler {
  return (request) => app.fetch(request);
}
