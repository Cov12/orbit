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
