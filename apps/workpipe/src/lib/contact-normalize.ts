/**
 * Canonical form of a contact email for matching and storage: trimmed and
 * lower-cased, with a blank value collapsed to `undefined`.
 *
 * Lives outside `queries.ts` because that module is `'use server'` (every
 * export must be an async server action) and the public lead-capture ingest
 * path in `lead-ingest.ts` needs the same key to dedupe against.
 */
export const normalizeEmail = (email?: string | null): string | undefined => {
  const normalized = email?.trim().toLowerCase()
  return normalized ? normalized : undefined
}
