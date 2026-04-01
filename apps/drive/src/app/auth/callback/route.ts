import { NextRequest, NextResponse } from "next/server";

import {
  PORTAL_TOKEN_COOKIE,
  verifyPortalToken,
} from "@/lib/portal-jwt";

const DEFAULT_PORTAL_URL = "https://portal.orbit.example";

function getRefreshRedirect(request: NextRequest) {
  const portalUrl = process.env.NEXT_PUBLIC_PORTAL_URL ?? DEFAULT_PORTAL_URL;
  const callbackUrl = new URL(request.url);
  callbackUrl.search = "";

  const refreshUrl = new URL("/api/auth/refresh", portalUrl);
  refreshUrl.searchParams.set("redirect_uri", callbackUrl.toString());

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

  const response = NextResponse.redirect(new URL("/drive", request.url));
  const maxAge = Math.max(payload.exp - Math.floor(Date.now() / 1000), 0);

  response.cookies.set({
    name: PORTAL_TOKEN_COOKIE,
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  });

  return response;
}
