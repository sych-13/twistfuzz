// A client availability check only. Business authorization remains server-side;
// this ensures the SDK has received the fixed database transport claim after setup.
export async function finishCustomerSetup(response: unknown, refreshClaims: () => Promise<Record<string, unknown>>): Promise<void> {
  if (!response || typeof response !== 'object' || !('role' in response) || response.role !== 'customer' ||
      !('refreshToken' in response) || response.refreshToken !== true) throw new Error('Customer setup was not confirmed.');
  const claims = await refreshClaims();
  if (claims.role !== 'authenticated') throw new Error('Customer identity setup is still pending. Please sign in again later.');
}
