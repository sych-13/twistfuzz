import { provisionVerifiedCustomer } from '../_shared/customer.ts';
import type { CustomerProvisioningDependencies } from '../_shared/customer.ts';
import { createJsonEndpoint, requireEmptyBody } from '../_shared/http.ts';

export function createCustomerProvisioningHandler(options: { allowedOrigins: string[]; dependencies: () => CustomerProvisioningDependencies }) {
  return createJsonEndpoint({ ...options, async handle(body, token, dependencies) {
    requireEmptyBody(body);
    await provisionVerifiedCustomer(token, dependencies);
    return { role: 'customer', refreshToken: true };
  } });
}
