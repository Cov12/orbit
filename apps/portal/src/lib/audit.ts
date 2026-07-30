export function logEntitlementDecision(opts: {
  orgId: string;
  userId: string;
  app: string;
  decision: 'granted' | 'denied';
  reason: string;
}): void {
  console.info(
    JSON.stringify({
      kind: 'entitlement_decision',
      ts: new Date().toISOString(),
      ...opts,
    })
  );
}

export function logTokenExchange(opts: {
  orgId: string;
  userId: string;
  app: string;
  aud?: string;
  outcome: 'success' | 'denied' | 'error';
}): void {
  console.info(
    JSON.stringify({
      kind: 'token_exchange',
      ts: new Date().toISOString(),
      ...opts,
    })
  );
}

/** Audit trail for super-admin actions (login, app-access changes, …). */
export function logAdminAction(opts: {
  action: string;
  adminEmail: string;
  target?: string;
  outcome: 'success' | 'denied' | 'error';
  detail?: string;
}): void {
  console.info(
    JSON.stringify({
      kind: 'admin_action',
      ts: new Date().toISOString(),
      ...opts,
    })
  );
}
