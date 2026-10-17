import { createCustomerProvisioningHandler } from './handler.ts';
import { createServerRuntime, readAllowedOrigins } from '../_shared/runtime.ts';

Deno.serve(createCustomerProvisioningHandler({ allowedOrigins: readAllowedOrigins(Deno.env), dependencies: createServerRuntime(Deno.env) }));
