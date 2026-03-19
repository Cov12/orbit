import { NextResponse } from "next/server";

export function driveErrorResponse(error: unknown) {
  if (error instanceof Error) {
    if (error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error.message === "NO_ORG") {
      return NextResponse.json({ error: "Organization context is required" }, { status: 400 });
    }
    if (error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (error.message === "MULTI_ORG_SELECT_REQUIRED") {
      return NextResponse.json({ error: "Multiple organizations found. Set X-Org-Id header to select one." }, { status: 400 });
    }
    if (error.message === "DRIVE_ACCESS_DENIED") {
      return NextResponse.json({ error: "Drive access requires an active subscription. Upgrade at portal.orbit.example/billing" }, { status: 403 });
    }
  }

  console.error("[Drive API]", error);
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}

export function serializeBigInts<T>(payload: T): T {
  return JSON.parse(
    JSON.stringify(payload, (_, value) =>
      typeof value === "bigint" ? value.toString() : value
    )
  ) as T;
}
