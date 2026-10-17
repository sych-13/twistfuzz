import { createSavedDesignHandler } from './handler.ts';
import { createSavedDesignDependencies } from './runtime.ts';
import { readAllowedOrigins } from '../_shared/runtime.ts';

Deno.serve(createSavedDesignHandler({ allowedOrigins: readAllowedOrigins(Deno.env), dependencies: createSavedDesignDependencies(Deno.env) }));
