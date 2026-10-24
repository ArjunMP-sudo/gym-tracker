import { NextResponse } from "next/server";
import { z } from "zod";
import { guard } from "@/lib/auth";
import { dayPath } from "@/lib/defaults";
import { getFile, putFile } from "@/lib/store";
import { bad, fail } from "@/lib/http";
import { Day, dateStr } from "@/lib/schema";
export const dynamic = "force-dynamic";
type Ctx = { params: { date: string } };

export async function GET(req: Request, { params }: Ctx) {
  const g = guard(req); if (g) return g;
  const d = dateStr.safeParse(params.date); if (!d.success) return bad("Invalid date");
  try { const f = await getFile(dayPath(d.data)); return NextResponse.json({ day: f ? Day.parse(f.data) : null, sha: f?.sha ?? null }); }
  catch (e) { return fail(e); }
}

export async function PUT(req: Request, { params }: Ctx) {
  const g = guard(req, true); if (g) return g;
  try {
    const date = dateStr.parse(params.date);
    const body = z.object({ day: Day, sha: z.string().nullable() }).parse(await req.json().catch(() => null));
    if (body.day.date !== date) return bad("Date in body does not match URL");
    if (body.day.date > new Date(Date.now() + 2 * 864e5).toISOString().slice(0, 10)) return bad("Date is too far in the future");
    const day = { ...body.day, updatedAt: new Date().toISOString() };
    const sha = await putFile(dayPath(date), day, body.sha ?? undefined, `log: ${date}`);
    return NextResponse.json({ day, sha });
  } catch (e) { return fail(e); }
}
