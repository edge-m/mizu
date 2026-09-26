import { expect, test } from 'vitest';
import * as mizu from '../src/index.js';

test('exposes the public application entry points', () => {
  expect(Object.keys(mizu)).toEqual([
    'createApp',
    'cors',
    'csrf',
    'secureHeaders',
    'bodyLimit',
    'cacheControl',
    'logger',
    'requestId',
    'etag',
    'deleteCookie',
    'getCookie',
    'getCookies',
    'getSignedCookie',
    'setCookie',
    'setSignedCookie',
    'createNodeServer',
    'createRouter',
    'createWorkerHandler',
  ]);
});
