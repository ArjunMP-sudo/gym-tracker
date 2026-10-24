import { NextResponse } from "next/server";
import { z } from "zod";
import { guard } from "@/lib/auth";
import { getFile, putFile } from "@/lib/github";
import { fail } from "@/lib/http";
import { Profile } from "@/lib/schema";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  const g = guard(req); if (g) return g;
  try { const f = await getFile("profile.json"); return NextResponse.json({ profile: f ? Profile.parse(f.data) : null, sha: f?.sha ?? null }); }
  catch (e) { return fail(e); }
}
export async function PUT(req: Request) {
  const g = guard(req, true); if (g) return g;
  try {
    const b = z.object({ profile: Profile, sha: z.string().nullable() }).parse(await req.json().catch(() => null));
    const sha = await putFile("profile.json", b.profile, b.sha ?? undefined, "profile: update settings");
    return NextResponse.json({ profile: b.profile, sha });
  } catch (e) { return fail(e); }
}
