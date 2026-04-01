import * as jwt from "jsonwebtoken";

export interface PortalJwtPayload {
  sub: string;
  org_id: string;
  org_slug: string;
  role: string;
  email: string;
  name: string;
  subscriptions: { plan: string; status: string }[];
  app_access: string[];
  iat: number;
  exp: number;
}

export const PORTAL_TOKEN_COOKIE = "orbit_token";

function isPortalJwtPayload(value: unknown): value is PortalJwtPayload {
  if (!value || typeof value !== "object") {
    return false;
  }

  const payload = value as Record<string, unknown>;

  return (
    typeof payload.sub === "string" &&
    typeof payload.org_id === "string" &&
    typeof payload.org_slug === "string" &&
    typeof payload.role === "string" &&
    typeof payload.email === "string" &&
    typeof payload.name === "string" &&
    typeof payload.iat === "number" &&
    typeof payload.exp === "number" &&
    Array.isArray(payload.app_access) &&
    payload.app_access.every((access) => typeof access === "string") &&
    Array.isArray(payload.subscriptions) &&
    payload.subscriptions.every(
      (subscription) =>
        !!subscription &&
        typeof subscription === "object" &&
        typeof (subscription as { plan?: unknown }).plan === "string" &&
        typeof (subscription as { status?: unknown }).status === "string",
    )
  );
}

export function verifyPortalToken(token: string): PortalJwtPayload | null {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    return null;
  }

  try {
    const payload = jwt.verify(token, secret, {
      algorithms: ["HS256"],
    });

    return isPortalJwtPayload(payload) ? payload : null;
  } catch {
    return null;
  }
}

export function hasDriveAccess(payload: PortalJwtPayload): boolean {
  return payload.app_access.includes("DRIVE");
}
