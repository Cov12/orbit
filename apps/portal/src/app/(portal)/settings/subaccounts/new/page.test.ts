import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { ReactElement } from 'react';

const ATRIUM_URL = 'https://atrium.orbit.example';
const APP_URL = 'https://portal.orbit.example';

const orgMock = vi.fn();

vi.mock('@/lib/org-entitlements', () => ({
  getCurrentOrgEntitlements: () => orgMock(),
}));

// Stand-in for the client form so we can read the props the server page hands it.
const FormStub = () => null;
vi.mock('@/components/portal/subaccount-form', () => ({
  SubAccountForm: FormStub,
}));

vi.mock('next/navigation', () => ({
  redirect: (path: string) => {
    throw new Error(`REDIRECT:${path}`);
  },
}));

const ORIGINAL = { ...process.env };

/**
 * ALLOWED_ORIGINS is computed at module load, so the env has to be in place
 * before the page (and through it src/lib/return-to) is imported — the same
 * idiom as src/lib/return-to.test.ts.
 */
async function loadPage() {
  process.env.NEXT_PUBLIC_ATRIUM_URL = ATRIUM_URL;
  process.env.NEXT_PUBLIC_APP_URL = APP_URL;
  delete process.env.NEXT_PUBLIC_WORKPIPE_URL;
  delete process.env.NEXT_PUBLIC_DRIVE_URL;
  delete process.env.NEXT_PUBLIC_CONDUCTOR_URL;
  vi.resetModules();
  return (await import('./page')).default;
}

/** Find the props the page passed to <SubAccountForm />. */
function formProps(node: unknown): Record<string, unknown> | null {
  if (!node || typeof node !== 'object') return null;
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = formProps(child);
      if (found) return found;
    }
    return null;
  }
  const element = node as ReactElement<Record<string, unknown>>;
  if (!('props' in element)) return null;
  if (element.type === FormStub) return element.props;
  return formProps(element.props?.children);
}

async function renderWith(returnTo?: string | string[]) {
  const Page = await loadPage();
  const element = await Page({ searchParams: Promise.resolve({ returnTo }) });
  return formProps(element);
}

beforeEach(() => {
  process.env = { ...ORIGINAL };
  vi.clearAllMocks();
  orgMock.mockResolvedValue({
    orgId: 'org_1',
    orgName: 'Acme',
    role: 'OWNER',
    isPlatformAdmin: true,
    appStatus: {},
    subscriptions: [],
  });
});

afterEach(() => {
  process.env = { ...ORIGINAL };
});

describe('/settings/subaccounts/new — server-side returnTo validation', () => {
  it('passes an allowlisted app origin straight through to the form', async () => {
    const props = await renderWith(`${ATRIUM_URL}/sub-accounts?tab=all`);
    expect(props?.returnTo).toBe(`${ATRIUM_URL}/sub-accounts?tab=all`);
  });

  it('an unknown origin becomes null', async () => {
    const props = await renderWith('https://evil.example.com/auth/callback');
    expect(props?.returnTo).toBeNull();
  });

  it('a javascript: URL becomes null', async () => {
    const props = await renderWith('javascript:alert(1)');
    expect(props?.returnTo).toBeNull();
  });

  it('a look-alike host becomes null', async () => {
    const props = await renderWith('https://portal.orbit.example.evil.example.com/x');
    expect(props?.returnTo).toBeNull();
  });

  it('a malformed URL becomes null', async () => {
    const props = await renderWith('http://[bad');
    expect(props?.returnTo).toBeNull();
  });

  it('no returnTo at all is null', async () => {
    const props = await renderWith(undefined);
    expect(props?.returnTo).toBeNull();
  });

  it('a repeated ?returnTo= param is still validated (first value wins)', async () => {
    const props = await renderWith([`${ATRIUM_URL}/ok`, 'https://evil.example.com/x']);
    expect(props?.returnTo).toBe(`${ATRIUM_URL}/ok`);
  });
});

describe('/settings/subaccounts/new — role gate', () => {
  it('OWNER → isAdmin true', async () => {
    const props = await renderWith();
    expect(props?.isAdmin).toBe(true);
  });

  it('MEMBER → isAdmin false', async () => {
    orgMock.mockResolvedValue({
      orgId: 'org_1',
      orgName: 'Acme',
      role: 'MEMBER',
      isPlatformAdmin: false,
      appStatus: {},
      subscriptions: [],
    });
    const props = await renderWith();
    expect(props?.isAdmin).toBe(false);
  });

  it('no workspace membership → redirects into onboarding', async () => {
    orgMock.mockResolvedValue(null);
    const Page = await loadPage();
    await expect(Page({ searchParams: Promise.resolve({}) })).rejects.toThrow(
      'REDIRECT:/onboarding/new-workspace'
    );
  });
});
