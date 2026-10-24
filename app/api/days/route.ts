import { NextResponse } from "next/server";
import { guard } from "@/lib/auth";
import { loadDays } from "@/lib/github";
import { bad, fail } from "@/lib/http";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  const g = guard(req); if (g) return g;
  const month = new URL(req.url).searchParams.get("month");
  if (month && !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return bad("Invalid month");
  try { return NextResponse.json(await loadDays(month ? month.replace("-", "/") + "/" : "")); }
  catch (e) { return fail(e); }
}
