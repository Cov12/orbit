import { describe, it, expect, beforeEach, vi } from 'vitest';

const subAccountFindFirstMock = vi.fn();

vi.mock('@/lib/db', () => ({
  db: {
    subAccount: { findFirst: (...args: unknown[]) => subAccountFindFirstMock(...args) },
  },
}));

import { resolveActiveSubAccountId, uniqueSubAccountSlug } from './subaccount';

describe('resolveActiveSubAccountId — cross-org leak guard', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns null and never queries when candidate is empty', async () => {
    expect(await resolveActiveSubAccountId('org_1', undefined)).toBeNull();
    expect(await resolveActiveSubAccountId('org_1', null)).toBeNull();
    expect(await resolveActiveSubAccountId('org_1', '')).toBeNull();
    expect(subAccountFindFirstMock).not.toHaveBeenCalled();
  });

  it('returns the id when the sub-account is ACTIVE and belongs to the org', async () => {
    subAccountFindFirstMock.mockResolvedValue({ id: 'sub_1' });
    const result = await resolveActiveSubAccountId('org_1', 'sub_1');
    expect(result).toBe('sub_1');
    // The where clause is the guard: id + orgId + ACTIVE all required.
    expect(subAccountFindFirstMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'sub_1', orgId: 'org_1', status: 'ACTIVE' },
      })
    );
  });

  it('returns null when the sub-account belongs to a different org (no match)', async () => {
    // db.findFirst with the org-scoped where returns null for a foreign/stale id.
    subAccountFindFirstMock.mockResolvedValue(null);
    expect(await resolveActiveSubAccountId('org_1', 'sub_from_org_2')).toBeNull();
  });
});

describe('uniqueSubAccountSlug', () => {
  beforeEach(() => vi.clearAllMocks());

  it('slugifies the name and returns it when free', async () => {
    subAccountFindFirstMock.mockResolvedValue(null);
    expect(await uniqueSubAccountSlug('org_1', 'Acme West Coast!')).toBe('acme-west-coast');
  });

  it('appends a numeric suffix on collision', async () => {
    subAccountFindFirstMock
      .mockResolvedValueOnce({ id: 'x' }) // "acme" taken
      .mockResolvedValueOnce(null); // "acme-1" free
    expect(await uniqueSubAccountSlug('org_1', 'Acme')).toBe('acme-1');
  });

  it('falls back to a default base when the name has no slug-able chars', async () => {
    subAccountFindFirstMock.mockResolvedValue(null);
    expect(await uniqueSubAccountSlug('org_1', '!!!')).toBe('sub-account');
  });
});
