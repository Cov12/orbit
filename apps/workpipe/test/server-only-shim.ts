// In tests, `server-only` is a no-op — the server-guard modules import it only
// to fail a client bundle, which doesn't apply under vitest's node environment.
export {}
