import { db } from "@/lib/db";

/**
 * Resolve the active sub-account id for a token mint, strictly scoped to one workspace.
 *
 * Returns the candidate id ONLY if it names an ACTIVE sub-account belonging to `orgId`.
 * Otherwise returns `null` (= business scope). This is the cross-org leak guard: a
 * sub-account id from a different workspace (e.g. a stale `orbit_subaccount` cookie left
 * over from a previous workspace) can never resolve into another org's token.
 */
export async function resolveActiveSubAccountId(
  orgId: string,
  candidate: string | null | undefined
): Promise<string | null> {
  if (!candidate) return null;
  const sub = await db.subAccount.findFirst({
    where: { id: candidate, orgId, status: "ACTIVE" },
    select: { id: true },
  });
  return sub?.id ?? null;
}

/**
 * Slugify a sub-account name the same way workspaces do, then make it unique within the
 * org (sub-account slugs are unique per `orgId`, not globally).
 */
export async function uniqueSubAccountSlug(orgId: string, name: string): Promise<string> {
  const baseSlug =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 30) || "sub-account";

  let slug = baseSlug;
  let suffix = 1;
  while (await db.subAccount.findFirst({ where: { orgId, slug }, select: { id: true } })) {
    slug = `${baseSlug}-${suffix}`;
    suffix++;
  }
  return slug;
}
