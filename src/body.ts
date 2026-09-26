export class BodyParsingError extends Error {
  constructor(message = 'Request body could not be parsed') {
    super(message);
    this.name = 'BodyParsingError';
  }
}

const extractedBodies = new WeakMap<Request, Promise<unknown>>();

function formDataObject(formData: FormData): Record<string, FormDataEntryValue | FormDataEntryValue[]> {
  const result: Record<string, FormDataEntryValue | FormDataEntryValue[]> = {};
  for (const [key, value] of formData.entries()) {
    const previous = result[key];
    if (previous === undefined) {
      result[key] = value;
    } else if (Array.isArray(previous)) {
      previous.push(value);
    } else {
      result[key] = [previous, value];
    }
  }
  return result;
}

async function parseBody(request: Request): Promise<unknown> {
  const contentType = request.headers.get('content-type')?.toLowerCase() ?? '';
  try {
    if (contentType.startsWith('application/json')) {
      return await request.json();
    }
    if (contentType.startsWith('text/')) {
      return await request.text();
    }
    if (contentType.startsWith('application/x-www-form-urlencoded')) {
      return formDataObject(await request.formData());
    }
    if (contentType.startsWith('multipart/form-data')) {
      return await request.formData();
    }
    if (contentType.startsWith('application/octet-stream')) {
      return await request.arrayBuffer();
    }
    if (/^(image|audio|video)\//.test(contentType) || contentType === 'application/pdf') {
      return await request.blob();
    }
  } catch (error) {
    if (error instanceof BodyLimitExceeded) throw error;
    throw new BodyParsingError();
  }

  throw new BodyParsingError('Request body content type is unsupported');
}

export function extractBody(request: Request): Promise<unknown> {
  const cached = extractedBodies.get(request);
  if (cached) return cached;

  const body = parseBody(request);
  extractedBodies.set(request, body);
  return body;
}
import { BodyLimitExceeded } from './operational.js';
