import { NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "./auth";

// A browser request carries the session cookie (set at login). A machine
// request (n8n) carries x-api-key. Both are accepted.

/** Admin actions: valid session cookie OR the admin API key. */
export async function isAdmin(req: NextRequest): Promise<boolean> {
  if (await verifySession(req.cookies.get(SESSION_COOKIE)?.value)) return true;
  const key = req.headers.get("x-api-key");
  return Boolean(process.env.ADMIN_API_KEY) && key === process.env.ADMIN_API_KEY;
}

/** Creating a job: admin (session/admin key) OR the intake key (website/n8n). */
export async function canCreate(req: NextRequest): Promise<boolean> {
  if (await isAdmin(req)) return true;
  const key = req.headers.get("x-api-key");
  return Boolean(process.env.INTAKE_API_KEY) && key === process.env.INTAKE_API_KEY;
}
