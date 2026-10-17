import { AccessError, authenticate } from '../_shared/auth.ts';
import type { AuthDependencies } from '../_shared/auth.ts';
import { createJsonEndpoint } from '../_shared/http.ts';
import { parseDesignCommand, parseDesignResult } from '../../../src/features/studio/savedDesigns.ts';
import type { DesignCommand } from '../../../src/features/studio/savedDesigns.ts';

export type SavedDesignDependencies = {
  auth: AuthDependencies;
  execute: (uid: string, token: string, command: DesignCommand) => Promise<unknown>;
};
export function createSavedDesignHandler(options: { allowedOrigins: string[]; dependencies: () => SavedDesignDependencies }) {
  return createJsonEndpoint({ ...options, maxBodyBytes: 16000, async handle(body, token, dependencies) {
    let command: DesignCommand;
    try { command = parseDesignCommand(body); }
    catch { throw new AccessError(400, 'invalid_design_request', 'Use a valid design name and supported bouquet options, up to 30 stems.'); }
    const { identity, role } = await authenticate(token, dependencies.auth);
    if (role !== 'customer') throw new AccessError(403, 'customer_required', 'Saved designs are available to Customer accounts.');
    return parseDesignResult(await dependencies.execute(identity.uid, token, command), command);
  } });
}
