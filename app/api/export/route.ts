import { guard } from "@/lib/auth";
import { DEFAULT_PROFILE, dayPath } from "@/lib/defaults";
import { buildExport } from "@/lib/export";
import { getFile, loadDays } from "@/lib/github";
import { bad, fail } from "@/lib/http";
import { Day, Profile, dateStr } from "@/lib/schema";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const g = guard(req); if (g) return g;
  const q = new URL(req.url).searchParams, scope = q.get("scope"), value = q.get("value") ?? "";
  try {
    const pf = await getFile("profile.json");
    const profile = pf ? Profile.parse(pf.data) : DEFAULT_PROFILE;
    let r: { days: Day[]; failed: string[]; sourceFiles: number }, name: string, title: string;
    let today: string; try { today = new Date().toLocaleDateString("en-CA", { timeZone: profile.tz }); } catch { today = new Date().toISOString().slice(0, 10); }
    if (scope === "day") {
      const date = dateStr.parse(value); const f = await getFile(dayPath(date));
      r = { days: f ? [Day.parse(f.data)] : [], failed: [], sourceFiles: f ? 1 : 0 };
      name = `ASCEND_${date}.txt`; title = `DAILY LOG ${date}`;
    } else if (scope === "month") {
      if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) return bad("Invalid month");
      r = await loadDays(value.replace("-", "/") + "/"); name = `ASCEND_${value}.txt`; title = `MONTHLY HISTORY ${value}`;
    } else if (scope === "all") {
      r = await loadDays(); name = `ASCEND_ALL_HISTORY_${today}.txt`; title = "PERSONAL FITNESS HISTORY";
    } else return bad("scope must be day, month or all");
    const text = buildExport({ ...r, profile, title, exportedAt: new Date().toISOString() });
    return new Response(text, { headers: { "Content-Type": "text/plain; charset=utf-8", "Content-Disposition": `attachment; filename="${name}"`, "Cache-Control": "no-store" } });
  } catch (e) { return fail(e); }
}
