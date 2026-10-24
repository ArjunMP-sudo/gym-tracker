import { dayTotals, e1rm, sleepMinutes, waterTotal } from "./calc";
import type { Day, Profile } from "./schema";

const clean = (s: string) => s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").replace(/\r\n?|\n/g, "\n      ");
const avg = (a: number[]) => (a.length ? Math.round((a.reduce((s, x) => s + x, 0) / a.length) * 10) / 10 : null);
const show = (v: number | null, u: string) => (v === null ? "no data" : `${v} ${u}`);

export function formatDay(d: Day, p: Profile): string {
  const L: string[] = ["=".repeat(50), `DAILY LOG — ${d.date}`, ""];
  if (d.weightKg !== undefined) L.push("BODY WEIGHT", `Morning weight: ${d.weightKg} kg`, "");
  const m = d.measurements;
  if (m) L.push("MEASUREMENTS", ...Object.entries(m).map(([k, v]) => `${k}: ${v}`), "");
  if (d.meals.length) {
    const t = dayTotals(d);
    L.push("NUTRITION", `Calories: ${t.kcal} kcal (target ${p.targets.kcal})`, `Protein: ${t.protein} g (target ${p.targets.protein})`, `Carbohydrates: ${t.carbs} g`, `Fat: ${t.fat} g`, "", "MEALS");
    for (const cat of ["breakfast", "lunch", "dinner", "snack", "pre-workout", "post-workout"]) {
      const ms = d.meals.filter((x) => x.category === cat);
      if (!ms.length) continue;
      L.push(cat[0].toUpperCase() + cat.slice(1));
      for (const x of ms)
        L.push(`- ${clean(x.name)}, ${x.qty} ${x.unit} | ${x.kcal} kcal, P ${x.protein} g, C ${x.carbs} g, F ${x.fat} g | ${x.estimated ? "estimated" : "verified"} | ${x.time}${x.notes ? " | " + clean(x.notes) : ""}`);
    }
    L.push("");
  }
  if (d.workout) {
    const w = d.workout;
    L.push("WORKOUT", `Session: ${clean(w.name)} (${w.completed ? "completed" : "PLANNED, not confirmed"})`);
    if (w.durationMin !== undefined) L.push(`Duration: ${w.durationMin} min`);
    for (const e of w.exercises) {
      L.push(`Exercise: ${clean(e.name)} [${e.muscle}]`);
      e.sets.forEach((s, i) => L.push(`- ${s.warmup ? "Warm-up" : "Set"} ${i + 1}: ${s.weight} ${s.unit} × ${s.reps} reps${s.rpe ? ` @RPE ${s.rpe}` : ""}`));
      const est = e1rm(e.sets);
      if (est !== null && e.sets[0]?.unit) L.push(`  Estimated 1RM (estimate only): ${est} ${e.sets[0].unit}`);
      if (e.notes) L.push(`  Notes: ${clean(e.notes)}`);
    }
    if (w.notes) L.push(`Notes: ${clean(w.notes)}`);
    L.push("");
  } else if (d.restDay) L.push("WORKOUT", "Rest day (logged)", "");
  if (d.steps !== undefined) L.push("STEPS", `Steps: ${d.steps}`, "");
  if (d.water.length) L.push("WATER", `Total: ${waterTotal(d)} ml (target ${p.targets.water})`, ...d.water.map((w) => `- ${w.ml} ml at ${w.time}`), "");
  const sm = sleepMinutes(d.sleep);
  if (d.sleep && sm !== null) {
    const s = d.sleep;
    L.push("SLEEP", `Bedtime: ${s.bedtime}  Wake: ${s.wake}  Duration: ${Math.floor(sm / 60)} h ${sm % 60} min`,
      `Quality: ${s.quality ?? "-"}/5  Energy: ${s.energy ?? "-"}/5  Soreness: ${s.soreness ?? "-"}/5  Recovery: ${s.recovery ?? "-"}/5`, "");
  }
  if (d.notes.length) L.push("NOTES", ...d.notes.map((n) => `- [${n.time}] ${clean(n.text)}`), "");
  return L.join("\n");
}

function monthSummary(ym: string, days: Day[]) {
  const ds = days.filter((d) => d.date.startsWith(ym));
  const withMeals = ds.filter((d) => d.meals.length);
  const w = ds.filter((d) => d.weightKg !== undefined);
  return [
    `MONTHLY SUMMARY — ${ym} (only from available records)`,
    `Days with a record: ${ds.length}`,
    `Avg calories (${withMeals.length} days with food logged): ${show(avg(withMeals.map((d) => dayTotals(d).kcal)), "kcal")}`,
    `Avg protein: ${show(avg(withMeals.map((d) => dayTotals(d).protein)), "g")}`,
    `Avg water (${ds.filter((d) => d.water.length).length} days logged): ${show(avg(ds.filter((d) => d.water.length).map(waterTotal)), "ml")}`,
    `Avg sleep: ${show(avg(ds.map((d) => sleepMinutes(d.sleep)).filter((x): x is number => x !== null).map((x) => x / 60)), "h")}`,
    `Workouts completed: ${ds.filter((d) => d.workout?.completed).length}  Planned/unconfirmed: ${ds.filter((d) => d.workout && !d.workout.completed).length}  Rest days logged: ${ds.filter((d) => d.restDay).length}`,
    `Weight: ${w.length ? `${w[0].weightKg} kg (${w[0].date}) -> ${w[w.length - 1].weightKg} kg (${w[w.length - 1].date})` : "no weigh-ins"}`,
    "",
  ].join("\n");
}

export function buildExport(o: { days: Day[]; profile: Profile; title: string; exportedAt: string; failed: string[]; sourceFiles: number }): string {
  const { days, profile: p } = o;
  const complete = o.failed.length === 0 && days.length === o.sourceFiles;
  const L: string[] = [`ASCEND — ${o.title}`, `Exported at: ${o.exportedAt}`];
  L.push(days.length ? `Date range: ${days[0].date} to ${days[days.length - 1].date}` : "Date range: (no records)", `Timezone: ${p.tz}`, "",
    "PROFILE", `Height: ${p.heightCm} cm`, `Target weight: ${p.targetWeightKg ?? "not set"}${p.targetWeightKg ? " kg" : ""}`, `Goal: ${p.goal}`,
    `Targets: ${p.targets.kcal} kcal, ${p.targets.protein} g protein, ${p.targets.water} ml water, ${p.targets.sleepH} h sleep`, "");
  if (!days.length) L.push("No records were found for the selected range.", "");
  for (const d of days) L.push(formatDay(d, p));
  const months = [...new Set(days.map((d) => d.date.slice(0, 7)))];
  if (months.length) L.push("=".repeat(50), ...months.map((m) => monthSummary(m, days)));
  const count = (f: (d: Day) => number) => days.reduce((s, d) => s + f(d), 0);
  L.push("=".repeat(50), "EXPORT SUMMARY",
    `Days: ${days.length}`, `Meals/food entries: ${count((d) => d.meals.length)}`,
    `Workouts completed: ${count((d) => (d.workout?.completed ? 1 : 0))} (planned, unconfirmed: ${count((d) => (d.workout && !d.workout.completed ? 1 : 0))})`,
    `Days with body measurements/weight: ${count((d) => (d.weightKg !== undefined || d.measurements ? 1 : 0))}`,
    `Water entries: ${count((d) => d.water.length)}`, `Notes: ${count((d) => d.notes.length)}`,
    `Source files found: ${o.sourceFiles}, loaded: ${days.length}`,
    `STATUS: ${complete ? "COMPLETE" : "INCOMPLETE — these files could not be read: " + o.failed.join(", ")}`, "");
  return L.join("\n");
}
