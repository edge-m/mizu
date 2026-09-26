import { expect, test } from 'vitest';
import {
  deleteCookie,
  getCookie,
  getCookies,
  getSignedCookie,
  setCookie,
  setSignedCookie,
} from '../src/index.js';

test('parses request cookies and decodes values', () => {
  const request = new Request('http://localhost/', {
    headers: { cookie: 'session=abc; theme=dark%20mode' },
  });

  expect(getCookie(request, 'session')).toBe('abc');
  expect(getCookies(request)).toEqual({
    session: 'abc',
    theme: 'dark mode',
  });
});

test('appends independent Set-Cookie headers with attributes', () => {
  const headers = new Headers();

  setCookie(headers, 'session', 'abc 123', {
    httpOnly: true,
    maxAge: 3600,
    path: '/',
    sameSite: 'Lax',
    secure: true,
  });
  setCookie(headers, 'theme', 'dark');

  expect(headers.getSetCookie()).toEqual([
    'session=abc%20123; Max-Age=3600; Path=/; Secure; HttpOnly; SameSite=Lax',
    'theme=dark',
  ]);
});

test('deletes a cookie by expiring it immediately', () => {
  const headers = new Headers();

  deleteCookie(headers, 'session', { path: '/' });

  expect(headers.getSetCookie()[0]).toMatch(
    /^session=; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Path=\/$/,
  );
});

test('round-trips a signed cookie with Web Crypto', async () => {
  const headers = new Headers();
  await setSignedCookie(headers, 'session', 'user-123', 'secret', {
    httpOnly: true,
    path: '/',
  });

  const request = new Request('http://localhost/', {
    headers: { cookie: headers.getSetCookie()[0].split(';')[0] },
  });

  await expect(getSignedCookie(request, 'session', 'secret')).resolves.toBe(
    'user-123',
  );
});

test('rejects a tampered signed cookie', async () => {
  const request = new Request('http://localhost/', {
    headers: { cookie: 'session=user-123.invalid-signature' },
  });

  await expect(getSignedCookie(request, 'session', 'secret')).resolves.toBe(
    undefined,
  );
});
