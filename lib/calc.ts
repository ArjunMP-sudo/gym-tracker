import type { Day } from "./schema";
const c = (x: number) => Math.round(x * 100); // integer hundredths: no float drift when summing
export function dayTotals(d: Day) {
  let k = 0, p = 0, cb = 0, f = 0;
  for (const m of d.meals) { k += c(m.kcal); p += c(m.protein); cb += c(m.carbs); f += c(m.fat); }
  return { kcal: k / 100, protein: p / 100, carbs: cb / 100, fat: f / 100 };
}
export const waterTotal = (d: Day) => d.water.reduce((s, w) => s + Math.round(w.ml), 0);
export function sleepMinutes(s?: Day["sleep"]): number | null {
  if (!s) return null;
  const t = (x: string) => Number(x.slice(0, 2)) * 60 + Number(x.slice(3));
  const diff = (t(s.wake) - t(s.bedtime) + 1440) % 1440; // handles crossing midnight
  return diff === 0 ? null : diff;
}
export const hasData = (d: Day) =>
  d.weightKg !== undefined || !!d.measurements || d.meals.length > 0 || !!d.workout || d.water.length > 0 ||
  !!d.sleep || d.notes.length > 0 || d.restDay || d.steps !== undefined;
// Epley estimate; only for 1-12 valid reps with load > 0. It is an estimate, not a tested max.
export function e1rm(sets: { reps: number; weight: number; warmup?: boolean }[]): number | null {
  const v = sets.filter((s) => !s.warmup && s.weight > 0 && s.reps >= 1 && s.reps <= 12);
  if (!v.length) return null;
  return Math.round(Math.max(...v.map((s) => s.weight * (1 + s.reps / 30))) * 10) / 10;
}
