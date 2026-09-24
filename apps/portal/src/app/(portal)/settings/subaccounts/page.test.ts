import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { ReactElement } from 'react';

const orgMock = vi.fn();
const findManyMock = vi.fn();

vi.mock('@/lib/org-entitlements', () => ({
  getCurrentOrgEntitlements: () => orgMock(),
}));

vi.mock('@/lib/db', () => ({
  db: {
    subAccount: { findMany: (...args: unknown[]) => findManyMock(...args) },
  },
}));

vi.mock('next/navigation', () => ({
  redirect: (path: string) => {
    throw new Error(`REDIRECT:${path}`);
  },
}));

import Page from './page';

/** Walk the returned element tree, collecting every href and every text node. */
function walk(node: unknown, out: { hrefs: string[]; text: string[] }): void {
  if (node === null || node === undefined || typeof node === 'boolean') return;
  if (typeof node === 'string' || typeof node === 'number') {
    out.text.push(String(node));
    return;
  }
  if (Array.isArray(node)) {
    for (const child of node) walk(child, out);
    return;
  }
  const element = node as ReactElement<Record<string, unknown>>;
  if (typeof element !== 'object' || !('props' in element)) return;
  const href = element.props?.href;
  if (typeof href === 'string') out.hrefs.push(href);
  walk(element.props?.children, out);
}

async function render() {
  const out: { hrefs: string[]; text: string[] } = { hrefs: [], text: [] };
  walk(await Page(), out);
  return { ...out, joined: out.text.join(' ') };
}

const SUB_ACCOUNTS = [
  { id: 'sa_1', name: 'Acme Client', slug: 'acme-client', createdAt: new Date('2026-01-02') },
  { id: 'sa_2', name: 'Globex', slug: 'globex', createdAt: new Date('2026-02-03') },
];

beforeEach(() => {
  vi.clearAllMocks();
  orgMock.mockResolvedValue({
    orgId: 'org_1',
    orgName: 'Acme',
    role: 'OWNER',
    isPlatformAdmin: true,
    appStatus: {},
    subscriptions: [],
  });
  findManyMock.mockResolvedValue(SUB_ACCOUNTS);
});

describe('/settings/subaccounts', () => {
  it('lists only ACTIVE sub-accounts scoped to the session workspace', async () => {
    const { joined } = await render();

    expect(findManyMock).toHaveBeenCalledTimes(1);
    const [query] = findManyMock.mock.calls[0] as [{ where: Record<string, unknown> }];
    // Multi-tenancy: the org comes from the server-resolved session, never a param.
    expect(query.where).toEqual({ orgId: 'org_1', status: 'ACTIVE' });

    expect(joined).toContain('Acme Client');
    expect(joined).toContain('Globex');
  });

  it('OWNER/ADMIN gets the add affordance', async () => {
    const { hrefs, joined } = await render();
    expect(hrefs).toContain('/settings/subaccounts/new');
    expect(joined).toContain('Add sub-account');
  });

  it('MEMBER still sees the list but gets no add affordance', async () => {
    orgMock.mockResolvedValue({
      orgId: 'org_1',
      orgName: 'Acme',
      role: 'MEMBER',
      isPlatformAdmin: false,
      appStatus: {},
      subscriptions: [],
    });

    const { hrefs, joined } = await render();

    expect(hrefs).not.toContain('/settings/subaccounts/new');
    expect(joined).not.toContain('Add sub-account');
    // The list itself is still there.
    expect(joined).toContain('Acme Client');
    expect(joined).toContain('Only workspace owners and admins can add sub-accounts.');
  });

  it('renders an empty state without crashing', async () => {
    findManyMock.mockResolvedValue([]);
    const { joined } = await render();
    expect(joined).toContain('No sub-accounts yet.');
  });

  it('no workspace membership → redirects into onboarding', async () => {
    orgMock.mockResolvedValue(null);
    await expect(Page()).rejects.toThrow('REDIRECT:/onboarding/new-workspace');
  });
});
