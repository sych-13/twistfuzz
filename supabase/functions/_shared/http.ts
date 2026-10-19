import { AccessError } from './auth.ts';

type EndpointOptions<Dependencies> = {
  allowedOrigins: string[]; dependencies: () => Dependencies; maxBodyBytes?: number; bodyReadTimeoutMs?: number;
  handle: (body: unknown, token: string, dependencies: Dependencies) => Promise<unknown>;
};

async function readJsonBody(request: Request, maxBytes: number, timeoutMs: number): Promise<unknown> {
  const declaredLength = request.headers.get('Content-Length');
  if (declaredLength !== null && (!/^\d+$/.test(declaredLength) || !Number.isSafeInteger(Number(declaredLength)))) {
    throw new AccessError(400, 'invalid_request', 'Use a valid JSON request.');
  }
  if (declaredLength !== null && Number(declaredLength) > maxBytes) {
    // A claimed short length is not trusted: the stream is still counted below.
    void request.body?.cancel().catch(() => {});
    throw new AccessError(413, 'body_too_large', 'The request is too large.');
  }
  const timedOut = () => new AccessError(408, 'request_timeout', 'The request was interrupted or took too long.');
  if (request.signal.aborted) throw timedOut();
  const reader = request.body?.getReader();
  if (!reader) throw new AccessError(400, 'invalid_request', 'Use a valid JSON request.');
  let timer: ReturnType<typeof setTimeout> | undefined;
  let abort = () => {};
  let complete = false;
  // One deadline for the entire body, not a fresh deadline for every chunk.
  const interrupted = new Promise<never>((_, reject) => {
    abort = () => reject(timedOut());
    timer = setTimeout(abort, timeoutMs);
    request.signal.addEventListener('abort', abort, { once: true });
  });
  try {
    const chunks: Uint8Array[] = [];
    let length = 0;
    while (true) {
      const chunk = await Promise.race([reader.read(), interrupted]);
      if (chunk.done) { complete = true; break; }
      length += chunk.value.byteLength;
      if (length > maxBytes) throw new AccessError(413, 'body_too_large', 'The request is too large.');
      chunks.push(chunk.value);
    }
    if (declaredLength !== null && length !== Number(declaredLength)) {
      throw new AccessError(400, 'invalid_request', 'Use a valid JSON request.');
    }
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch (error) {
    if (error instanceof AccessError) throw error;
    throw new AccessError(400, 'invalid_request', 'Use a valid JSON request.');
  } finally {
    clearTimeout(timer);
    request.signal.removeEventListener('abort', abort);
    // Cancellation itself may never settle; never await an untrusted stream's
    // cancel promise, and always observe its rejection before releasing the lock.
    if (!complete) void reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

export function requireEmptyBody(body: unknown): void {
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).length !== 0) {
    throw new AccessError(400, 'invalid_request', 'This request does not accept account or role fields.');
  }
}

export function createJsonEndpoint<Dependencies>(options: EndpointOptions<Dependencies>) {
  const maxBytes = options.maxBodyBytes ?? 512;
  const timeoutMs = options.bodyReadTimeoutMs ?? 5000;
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1 || !Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 5000) {
    throw new Error('Invalid server request limits');
  }
  return async (request: Request): Promise<Response> => {
    const origin = request.headers.get('Origin');
    const headers = new Headers({ 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Vary': 'Origin', 'X-Content-Type-Options': 'nosniff' });
    const respond = (status: number, body: unknown) => new Response(body === null ? null : JSON.stringify(body), { status, headers });
    if (origin && !options.allowedOrigins.includes(origin)) return respond(403, { error: 'origin_not_allowed' });
    if (origin) headers.set('Access-Control-Allow-Origin', origin);
    headers.set('Access-Control-Allow-Headers', 'authorization, apikey, content-type, x-client-info');
    headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    if (request.method === 'OPTIONS') return respond(204, null);
    if (request.method !== 'POST') { headers.set('Allow', 'POST, OPTIONS'); return respond(405, { error: 'method_not_allowed' }); }
    const authorization = request.headers.get('Authorization');
    if (!authorization || authorization.length > 16007 || !/^Bearer [\w-]+\.[\w-]+\.[\w-]+$/.test(authorization)) {
      return respond(401, { error: 'invalid_identity', message: 'Sign in again with a verified account.' });
    }
    try {
      if (!/^application\/json(?:;|$)/i.test(request.headers.get('Content-Type') ?? '')) return respond(415, { error: 'json_required' });
      const body = await readJsonBody(request, maxBytes, timeoutMs);
      const dependencies = options.dependencies();
      return respond(200, await options.handle(body, authorization.slice(7), dependencies));
    } catch (error) {
      if (error instanceof AccessError) {
        if (error.status === 429 && Number.isSafeInteger(error.retryAfterSeconds) && error.retryAfterSeconds! >= 1 && error.retryAfterSeconds! <= 60) {
          headers.set('Retry-After', String(error.retryAfterSeconds));
          headers.set('Access-Control-Expose-Headers', 'Retry-After');
        }
        return respond(error.status, { error: error.code, message: error.message });
      }
      return respond(503, { error: 'identity_service_unavailable', message: 'Account verification is temporarily unavailable.' });
    }
  };
}
