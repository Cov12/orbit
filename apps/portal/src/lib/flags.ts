type FlagName = 'portal_conductor_visible' | 'portal_conductor_launch_enabled';

const ENV_VAR_BY_FLAG: Record<FlagName, string> = {
  portal_conductor_visible: 'PORTAL_CONDUCTOR_VISIBLE_ORGS',
  portal_conductor_launch_enabled: 'PORTAL_CONDUCTOR_LAUNCH_ENABLED_ORGS',
};

function parseCsv(raw: string | undefined): Set<string> {
  if (!raw) return new Set();
  return new Set(
    raw
      .split(',')
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0)
  );
}

export function isFlagEnabled(
  flag: FlagName,
  org: { id: string; slug: string }
): boolean {
  const allowlist = parseCsv(process.env[ENV_VAR_BY_FLAG[flag]]);
  if (allowlist.size === 0) return false;
  if (allowlist.has(org.id)) return true;
  if (allowlist.has(org.slug)) return true;
  return false;
}
