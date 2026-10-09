import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, createSession, adminPassword } from "@/lib/auth";

export const runtime = "nodejs";

/** POST /api/auth/login — { password } -> sets the session cookie. */
export async function POST(req: NextRequest) {
  const pw = adminPassword();
  if (!pw) {
    return NextResponse.json(
      { error: "Login is not configured. Set ADMIN_PASSWORD." },
      { status: 500 }
    );
  }

  const body = (await req.json().catch(() => ({}))) as { password?: string };
  if (!body.password || body.password !== pw) {
    return NextResponse.json({ error: "Incorrect password." }, { status: 401 });
  }

  const token = await createSession();
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
  return res;
}
