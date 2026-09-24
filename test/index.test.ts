import { expect, test } from 'vitest';
import * as mizu from '../src/index.js';

test('exposes the public application entry points', () => {
  expect(Object.keys(mizu)).toEqual(['createApp', 'createNodeServer']);
});
