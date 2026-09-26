export type SameSite = 'Strict' | 'Lax' | 'None';

export type CookieOptions = {
  maxAge?: number;
  expires?: Date;
  domain?: string;
  path?: string;
  secure?: boolean;
  httpOnly?: boolean;
  sameSite?: SameSite;
  partitioned?: boolean;
};

function decodeCookieValue(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function encodeCookieValue(value: string): string {
  return encodeURIComponent(value);
}

export function getCookies(request: Request): Record<string, string> {
  const cookies: Record<string, string> = {};
  const header = request.headers.get('cookie');
  if (!header) return cookies;

  for (const part of header.split(';')) {
    const separator = part.indexOf('=');
    if (separator <= 0) continue;

    const name = part.slice(0, separator).trim();
    if (name in cookies) continue;

    cookies[name] = decodeCookieValue(part.slice(separator + 1).trim());
  }

  return cookies;
}

export function getCookie(
  request: Request,
  name: string,
): string | undefined {
  return getCookies(request)[name];
}

function validateCookieOptions(name: string, options: CookieOptions): void {
  if (name.startsWith('__Secure-') && !options.secure) {
    throw new Error('__Secure- cookies must use Secure');
  }

  if (name.startsWith('__Host-')) {
    if (!options.secure || options.path !== '/' || options.domain !== undefined) {
      throw new Error('__Host- cookies require Secure, Path=/, and no Domain');
    }
  }

  if (options.partitioned && !options.secure) {
    throw new Error('Partitioned cookies must use Secure');
  }
}

export function setCookie(
  headers: Headers,
  name: string,
  value: string,
  options: CookieOptions = {},
): Headers {
  validateCookieOptions(name, options);

  const parts = [`${name}=${encodeCookieValue(value)}`];
  if (options.maxAge !== undefined) parts.push(`Max-Age=${Math.trunc(options.maxAge)}`);
  if (options.expires !== undefined) parts.push(`Expires=${options.expires.toUTCString()}`);
  if (options.domain !== undefined) parts.push(`Domain=${options.domain}`);
  if (options.path !== undefined) parts.push(`Path=${options.path}`);
  if (options.secure) parts.push('Secure');
  if (options.httpOnly) parts.push('HttpOnly');
  if (options.sameSite) parts.push(`SameSite=${options.sameSite}`);
  if (options.partitioned) parts.push('Partitioned');

  headers.append('Set-Cookie', parts.join('; '));
  return headers;
}

export function deleteCookie(
  headers: Headers,
  name: string,
  options: Omit<CookieOptions, 'maxAge' | 'expires'> = {},
): Headers {
  return setCookie(headers, name, '', {
    ...options,
    maxAge: 0,
    expires: new Date(0),
  });
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);

  return btoa(binary)
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/, '');
}

function fromBase64Url(value: string): Uint8Array<ArrayBuffer> {
  const base64 = value.replaceAll('-', '+').replaceAll('_', '/');
  const padded = `${base64}${'='.repeat((4 - base64.length % 4) % 4)}`;
  const binary = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

async function cookieKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

export async function setSignedCookie(
  headers: Headers,
  name: string,
  value: string,
  secret: string,
  options: CookieOptions = {},
): Promise<Headers> {
  const key = await cookieKey(secret);
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(value),
  );

  return setCookie(
    headers,
    name,
    `${value}.${toBase64Url(new Uint8Array(signature))}`,
    options,
  );
}

export async function getSignedCookie(
  request: Request,
  name: string,
  secret: string,
): Promise<string | undefined> {
  const signedValue = getCookie(request, name);
  if (!signedValue) return undefined;

  const separator = signedValue.lastIndexOf('.');
  if (separator <= 0) return undefined;

  const value = signedValue.slice(0, separator);
  const signature = signedValue.slice(separator + 1);

  try {
    const key = await cookieKey(secret);
    const valid = await crypto.subtle.verify(
      'HMAC',
      key,
      fromBase64Url(signature),
      new TextEncoder().encode(value),
    );

    return valid ? value : undefined;
  } catch {
    return undefined;
  }
}
