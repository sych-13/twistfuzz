import { authenticate } from '../_shared/auth.ts';
import type { AuthDependencies } from '../_shared/auth.ts';
import { createJsonEndpoint, requireEmptyBody } from '../_shared/http.ts';

export function createRoleHandler(options: { allowedOrigins: string[]; dependencies: () => AuthDependencies }) {
  return createJsonEndpoint({ ...options, async handle(body, token, dependencies) {
    requireEmptyBody(body);
    const { role } = await authenticate(token, dependencies);
    return { role };
  } });
}