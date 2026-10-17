import { createRoleHandler } from '../supabase/functions/resolve-role/handler.ts';
import { createDependencies } from '../supabase/functions/_shared/runtime.ts';
import { createServerRuntime } from '../supabase/functions/_shared/runtime.ts';
import { createCustomerProvisioningHandler } from '../supabase/functions/provision-customer/handler.ts';
import { createSavedDesignHandler } from '../supabase/functions/saved-designs/handler.ts';
import { createSavedDesignDependencies } from '../supabase/functions/saved-designs/runtime.ts';

Deno.test('Deno HTTP runtime denies unconfigured auth without contacting external services', async () => {
  // This test has network permission for loopback only and uses no environment credentials.
  const emptyEnvironment = { get: (_name: string) => undefined };
  const controller = new AbortController();
  const handler = createRoleHandler({ allowedOrigins: ['http://127.0.0.1:5173'], dependencies: createDependencies(emptyEnvironment) });
  const server = Deno.serve({ hostname: '127.0.0.1', port: 0, signal: controller.signal, onListen: () => {} }, handler);
  try {
    const url = `http://127.0.0.1:${server.addr.port}/`;
    const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer a.b.c', Origin: 'http://127.0.0.1:5173' }, body: '{}' });
    const body = await response.json();
    if (response.status !== 503 || body.error !== 'auth_setup_pending') throw new Error('Unconfigured runtime did not deny access');
    const rejected = await fetch(url, { method: 'OPTIONS', headers: { Origin: 'https://untrusted.example.invalid' } });
    await rejected.body?.cancel();
    if (rejected.status !== 403) throw new Error('Unknown browser origin was accepted');
  } finally {
    controller.abort();
    await server.finished;
  }
});

Deno.test('Deno Customer provisioning HTTP runtime stays disabled without configuration', async () => {
  const controller = new AbortController();
  const handler = createCustomerProvisioningHandler({ allowedOrigins: ['http://127.0.0.1:5173'], dependencies: createServerRuntime({ get: () => undefined }) });
  const server = Deno.serve({ hostname: '127.0.0.1', port: 0, signal: controller.signal, onListen: () => {} }, handler);
  try {
    const response = await fetch(`http://127.0.0.1:${server.addr.port}/`, { method: 'POST', headers: {
      'Content-Type': 'application/json', Authorization: 'Bearer a.b.c', Origin: 'http://127.0.0.1:5173',
    }, body: '{}' });
    const body = await response.json();
    if (response.status !== 503 || body.error !== 'auth_setup_pending') throw new Error('Unconfigured Customer provisioning granted access');
  } finally { controller.abort(); await server.finished; }
});

Deno.test('Deno saved-design HTTP runtime denies unconfigured access without external clients', async () => {
  const handler = createSavedDesignHandler({ allowedOrigins: [], dependencies: createSavedDesignDependencies({ get: () => undefined }) });
  const response = await handler(new Request('http://127.0.0.1/', { method: 'POST', headers: {
    'Content-Type': 'application/json', Authorization: 'Bearer a.b.c',
  }, body: '{"action":"list"}' }));
  if (response.status !== 503 || (await response.json()).error !== 'auth_setup_pending') throw new Error('Unconfigured saved-design runtime granted access');
});
