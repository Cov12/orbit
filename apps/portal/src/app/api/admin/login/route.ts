import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { signAdminSession, setAdminCookie } from "@/lib/admin-auth";
import { logAdminAction } from "@/lib/audit";

// Best-effort per-IP throttle. In-memory ⇒ per-instance only, but it stops
// trivial brute-forcing. (A shared store would be the next step if needed.)
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const attempts = new Map<string, { count: number; resetAt: number }>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const rec = attempts.get(ip);
  if (!rec || now > rec.resetAt) {
    attempts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  rec.count += 1;
  return rec.count > MAX_ATTEMPTS;
}

export async function POST(req: Request) {
  // CSRF defense: a cross-site form POST would carry a foreign Origin.
  const origin = req.headers.get("origin");
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
  if (origin && host && new URL(origin).host !== host) {
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  }

  const ip = (req.headers.get("x-forwarded-for") || "unknown")
    .split(",")[0]
    .trim();
  if (rateLimited(ip)) {
    return NextResponse.json(
      { error: "Too many attempts. Try again later." },
      { status: 429 }
    );
  }

  let email = "";
  let password = "";
  try {
    const body = await req.json();
    email = String(body.email || "")
      .trim()
      .toLowerCase();
    password = String(body.password || "");
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  if (!email || !password) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const admin = await db.superAdmin.findUnique({ where: { email } });
  const ok = admin ? await bcrypt.compare(password, admin.passwordHash) : false;

  if (!admin || !ok) {
    logAdminAction({
      action: "login",
      adminEmail: email,
      outcome: "denied",
      detail: "invalid credentials",
    });
    // Generic message — don't reveal whether the email or the password was wrong.
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const token = signAdminSession({ id: admin.id, email: admin.email });
  await setAdminCookie(token);
  logAdminAction({
    action: "login",
    adminEmail: admin.email,
    outcome: "success",
  });

  return NextResponse.json({ ok: true });
}
