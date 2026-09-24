import { expect, test } from 'vitest';
import * as mizu from '../src/index.js';

test('exposes a stable public entry point', () => {
  expect(Object.keys(mizu)).toEqual([]);
});
