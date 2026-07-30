import "server-only";
import jwt from "jsonwebtoken";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";

/**
 * Super-admin authentication — deliberately SEPARATE from Clerk and from the
 * app JWT.
 *
 * - Signed with ADMIN_SESSION_SECRET, which MUST differ from JWT_SECRET (the app
 *   token). An admin session is therefore not a valid app token and vice versa,
 *   so an admin can never mint/impersonate an org's app JWT.
 * - Stored in an httpOnly + Secure + SameSite=Strict cookie so it isn't readable
 *   by JS and isn't sent on cross-site requests (CSRF mitigation).
 */
const ADMIN_COOKIE = "orbit_admin";
const SESSION_TTL_SECONDS = 8 * 60 * 60; // 8h

function adminSecret(): string {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) throw new Error("ADMIN_SESSION_SECRET is not set");
  if (secret === process.env.JWT_SECRET) {
    // Hard guardrail: reusing the app secret would let an admin session pass as
    // an app token (and vice versa). Refuse to run in that configuration.
    throw new Error("ADMIN_SESSION_SECRET must differ from JWT_SECRET");
  }
  return secret;
}

export interface AdminSession {
  id: string;
  email: string;
}

export function signAdminSession(admin: AdminSession): string {
  return jwt.sign({ sub: admin.id, email: admin.email }, adminSecret(), {
    algorithm: "HS256",
    expiresIn: SESSION_TTL_SECONDS,
  });
}

export async function setAdminCookie(token: string): Promise<void> {
  const store = await cookies();
  store.set(ADMIN_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function clearAdminCookie(): Promise<void> {
  const store = await cookies();
  store.delete(ADMIN_COOKIE);
}

/**
 * Resolve the current admin session, or null. Verifies the signature AND
 * re-checks that the SuperAdmin row still exists (so deleting an admin
 * immediately invalidates outstanding sessions).
 */
export async function getAdminSession(): Promise<AdminSession | null> {
  const store = await cookies();
  const token = store.get(ADMIN_COOKIE)?.value;
  if (!token) return null;
  try {
    const payload = jwt.verify(token, adminSecret(), {
      algorithms: ["HS256"],
    }) as { sub?: string; email?: string };
    if (!payload.sub) return null;
    const admin = await db.superAdmin.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true },
    });
    return admin ?? null;
  } catch {
    return null;
  }
}

/** Guard for admin pages/routes: returns the session or redirects to login. */
export async function requireAdmin(): Promise<AdminSession> {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");
  return session;
}
