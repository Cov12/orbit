import { NextRequest, NextResponse } from "next/server";

import {
  PORTAL_TOKEN_COOKIE,
  verifyPortalToken,
} from "@/lib/portal-jwt";

const DEFAULT_PORTAL_URL = "https://portal.orbit.example";

/**
 * Get the public-facing origin.
 * Render resolves req.url to localhost:PORT internally.
 */
function getPublicOrigin(req: NextRequest): string {
  const proto = req.headers.get("x-forwarded-proto") || "https";
  const host =
    req.headers.get("x-forwarded-host") ||
    req.headers.get("host") ||
    "drive.orbit.example";
  return `${proto}://${host}`;
}

function getRefreshRedirect(request: NextRequest) {
  const portalUrl = process.env.NEXT_PUBLIC_PORTAL_URL ?? DEFAULT_PORTAL_URL;
  const publicOrigin = getPublicOrigin(request);
  const callbackUrl = `${publicOrigin}/auth/callback`;

  const refreshUrl = new URL("/api/auth/refresh", portalUrl);
  refreshUrl.searchParams.set("redirect_uri", callbackUrl);

  return NextResponse.redirect(refreshUrl);
}

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");

  if (!token) {
    return getRefreshRedirect(request);
  }

  const payload = verifyPortalToken(token);

  if (!payload) {
    return getRefreshRedirect(request);
  }

  const publicOrigin = getPublicOrigin(request);
  const response = NextResponse.redirect(new URL("/drive", publicOrigin));
  const maxAge = Math.max(payload.exp - Math.floor(Date.now() / 1000), 0);

  response.cookies.set({
    name: PORTAL_TOKEN_COOKIE,
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    path: "/",
    maxAge,
  });

  return response;
}
