import type { Middleware } from './types.js';

export type SecureHeadersOptions = {
  contentSecurityPolicy?: string | false;
  strictTransportSecurity?: string | false;
  xContentTypeOptions?: string | false;
  xFrameOptions?: string | false;
  referrerPolicy?: string | false;
};

const DEFAULTS: Required<Omit<SecureHeadersOptions, 'contentSecurityPolicy' | 'strictTransportSecurity'>> = {
  xContentTypeOptions: 'nosniff',
  xFrameOptions: 'DENY',
  referrerPolicy: 'no-referrer',
};

function setIfMissing(
  response: Response,
  name: string,
  value: string | false | undefined,
): void {
  if (value !== false && value !== undefined && !response.headers.has(name)) {
    response.headers.set(name, value);
  }
}

export function secureHeaders(
  options: SecureHeadersOptions = {},
): Middleware {
  return async (_request, next) => {
    const response = await next();
    setIfMissing(
      response,
      'content-security-policy',
      options.contentSecurityPolicy,
    );
    setIfMissing(
      response,
      'strict-transport-security',
      options.strictTransportSecurity,
    );
    setIfMissing(
      response,
      'x-content-type-options',
      options.xContentTypeOptions ?? DEFAULTS.xContentTypeOptions,
    );
    setIfMissing(
      response,
      'x-frame-options',
      options.xFrameOptions ?? DEFAULTS.xFrameOptions,
    );
    setIfMissing(
      response,
      'referrer-policy',
      options.referrerPolicy ?? DEFAULTS.referrerPolicy,
    );
    return response;
  };
}
