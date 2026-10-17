import { createRoleHandler } from './handler.ts';
import { createDependencies, readAllowedOrigins } from '../_shared/runtime.ts';

Deno.serve(createRoleHandler({ allowedOrigins: readAllowedOrigins(Deno.env), dependencies: createDependencies(Deno.env) }));
