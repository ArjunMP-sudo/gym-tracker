import crypto from "crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export const COOKIE = "ascend_session";
const secret = () => {
  const s = process.env.SESSION_SECRET;
  if (s && s.length >= 32) return s;
  const pw = process.env.APP_PASSWORD;
  if (!pw) throw new Error("APP_PASSWORD must be set");
  return crypto.createHash("sha256").update("gym-tracker-session:" + pw).digest("hex"); // changing the password signs everyone out
};
const sign = (v: string) => crypto.createHmac("sha256", secret()).update(v).digest("base64url");
export function makeToken() { const v = String(Date.now() + 7 * 864e5); return `${v}.${sign(v)}`; }
export function verifyToken(t?: string) {
  if (!t) return false;
  const [v, sig] = t.split(".");
  if (!v || !sig) return false;
  const a = Buffer.from(sig), b = Buffer.from(sign(v));
  return a.length === b.length && crypto.timingSafeEqual(a, b) && Number(v) > Date.now();
}
export const isAuthed = () => verifyToken(cookies().get(COOKIE)?.value);

const hits = new Map<string, { n: number; reset: number }>();
export function limited(key: string, max: number, windowMs: number) { // best-effort, per serverless instance
  const now = Date.now(), h = hits.get(key);
  if (!h || h.reset < now) { hits.set(key, { n: 1, reset: now + windowMs }); return false; }
  return ++h.n > max;
}
export const ip = (req: Request) => req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "local";

/** Returns an error Response if the request must be rejected, else null. */
export function guard(req: Request, write = false): NextResponse | null {
  if (!isAuthed()) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (write) {
    if (req.headers.get("x-requested-with") !== "ascend") return NextResponse.json({ error: "Bad request origin" }, { status: 403 });
    if (limited("w:" + ip(req), 60, 60_000)) return NextResponse.json({ error: "Too many writes, slow down" }, { status: 429 });
  }
  return null;
}
