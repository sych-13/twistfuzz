import { AccessError } from './auth.ts';

type EndpointOptions<Dependencies> = {
  allowedOrigins: string[]; dependencies: () => Dependencies; maxBodyBytes?: number;
  handle: (body: unknown, token: string, dependencies: Dependencies) => Promise<unknown>;
};

export function requireEmptyBody(body: unknown): void {
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).length !== 0) {
    throw new AccessError(400, 'invalid_request', 'This request does not accept account or role fields.');
  }
}

export function createJsonEndpoint<Dependencies>(options: EndpointOptions<Dependencies>) {
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
      const dependencies = options.dependencies();
      if (!/^application\/json(?:;|$)/i.test(request.headers.get('Content-Type') ?? '')) return respond(415, { error: 'json_required' });
      const reader = request.body?.getReader();
      const chunks: Uint8Array[] = [];
      let length = 0;
      if (reader) {
        try {
          while (true) {
            const chunk = await reader.read();
            if (chunk.done) break;
            length += chunk.value.byteLength;
            if (length > (options.maxBodyBytes ?? 512)) { await reader.cancel(); return respond(413, { error: 'body_too_large' }); }
            chunks.push(chunk.value);
          }
        } finally { reader.releaseLock(); }
      }
      const bytes = new Uint8Array(length);
      let offset = 0;
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
      let body: unknown;
      try { body = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); }
      catch { return respond(400, { error: 'invalid_request' }); }
      return respond(200, await options.handle(body, authorization.slice(7), dependencies));
    } catch (error) {
      if (error instanceof AccessError) return respond(error.status, { error: error.code, message: error.message });
      return respond(503, { error: 'identity_service_unavailable', message: 'Account verification is temporarily unavailable.' });
    }
  };
}
