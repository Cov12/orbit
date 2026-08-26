/**
 * Shared allowlist + validator for cross-app "return to" redirects.
 *
 * These origins are the ONLY places Portal will bounce a user back to after an
 * authenticated action. The same list gates `/api/auth/refresh`, which mints a
 * fresh Orbit JWT and hands it to the redirect target — so an off-allowlist
 * origin here is a token-exfiltration hole, not a cosmetic open-redirect.
 * Treat this file as security-critical.
 */

const ORIGIN_ENV_VARS = [
  "NEXT_PUBLIC_WORKPIPE_URL",
  "NEXT_PUBLIC_DRIVE_URL",
  "NEXT_PUBLIC_ATRIUM_URL",
  "NEXT_PUBLIC_CONDUCTOR_URL",
  "NEXT_PUBLIC_APP_URL",
] as const;

function computeAllowedOrigins(): string[] {
  const origins = new Set<string>();

  for (const key of ORIGIN_ENV_VARS) {
    const value = process.env[key];
    if (!value) continue;
    try {
      origins.add(new URL(value).origin);
    } catch {
      // A single malformed env var must not take down module load (and with it
      // every route that imports this file). Skip it; the rest still apply.
      continue;
    }
  }

  return [...origins];
}

/**
 * Every origin Portal is allowed to redirect to, derived from the deployed app
 * URLs. Single source of truth — do not re-derive this list inline anywhere.
 *
 * Computed once at module load, matching how the rest of the repo tests
 * env-dependent modules (set `process.env` first, then `await import(...)`).
 */
export const ALLOWED_ORIGINS: string[] = computeAllowedOrigins();

/**
 * Validate a caller-supplied `returnTo` / `redirect_uri` value.
 *
 * SECURITY: the redirect this guards ends in a JWT mint — Portal appends a
 * freshly signed Orbit token to the target URL. Anything that gets past this
 * function receives a valid bearer credential for the current user, so a miss
 * is full account takeover on the attacker's origin, not just a phishing hop.
 *
 * Rejects (returns `null` for):
 *  - unparseable input, `null`, `undefined`
 *  - non-https schemes — blocks `javascript:` and `data:` payloads
 *    (`http:` is permitted only outside production, so local dev still works)
 *  - any origin not in {@link ALLOWED_ORIGINS}
 *
 * Never throws.
 *
 * @returns the normalized absolute URL string, or `null` if not allowed.
 */
export function resolveReturnTo(raw: string | null | undefined): string | null {
  if (!raw) return null;

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return null;
  }

  const httpAllowed = process.env.NODE_ENV !== "production";
  if (parsed.protocol !== "https:" && !(httpAllowed && parsed.protocol === "http:")) {
    return null;
  }

  if (!ALLOWED_ORIGINS.includes(parsed.origin)) return null;

  return parsed.toString();
}
