import crypto from "crypto";
import { NextResponse } from "next/server";
import { COOKIE, ip, limited, makeToken } from "@/lib/auth";
import { bad } from "@/lib/http";
export const dynamic = "force-dynamic";
const h = (s: string) => crypto.createHash("sha256").update(s).digest();
export async function POST(req: Request) {
  if (limited("login:" + ip(req), 5, 15 * 60_000)) return bad("Too many attempts. Try again in 15 minutes.", 429);
  const expected = process.env.APP_PASSWORD;
  if (!expected) return bad("APP_PASSWORD is not configured", 500);
  const { password } = (await req.json().catch(() => ({}))) as { password?: string };
  if (typeof password !== "string" || !crypto.timingSafeEqual(h(password), h(expected))) return bad("Wrong password", 401);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE, makeToken(), { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/", maxAge: 7 * 86400 });
  return res;
}
