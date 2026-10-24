import { dayTotals, hasData, sleepMinutes, waterTotal } from "./calc";
import type { Day, Profile } from "./schema";

// Progression rules live here, separate from the UI. XP is recomputed from saved data every time,
// so editing or reloading an entry can never award XP twice.
export const XP_RULES = {
  log: 10, workout: 30, plannedRest: 10, protein: 10, water: 10, sleep: 10,
  kcalBand: [0.8, 1.3] as const, // calories/protein XP only if intake is in a sane band (no undereating rewards)
  waterMaxFactor: 2, sleepMaxH: 10,
  levelBase: 60, // level = 1 + floor(sqrt(xp / levelBase))
};

export function dayXp(d: Day, p: Profile) {
  const r = XP_RULES, ev: { label: string; xp: number }[] = [];
  if (hasData(d)) ev.push({ label: "Logged", xp: r.log });
  const w = d.workout;
  const done = !!w?.completed && w.exercises.some((e) => e.sets.length > 0);
  if (done) ev.push({ label: "Workout completed", xp: r.workout });
  else if (d.restDay) ev.push({ label: "Planned rest day", xp: r.plannedRest });
  const t = dayTotals(d);
  const inBand = t.kcal >= p.targets.kcal * r.kcalBand[0] && t.kcal <= p.targets.kcal * r.kcalBand[1];
  if (inBand && t.protein >= p.targets.protein) ev.push({ label: "Nutrition target", xp: r.protein });
  const wt = waterTotal(d);
  if (wt >= p.targets.water && wt <= p.targets.water * r.waterMaxFactor) ev.push({ label: "Hydration target", xp: r.water });
  const sm = sleepMinutes(d.sleep);
  if (sm !== null && sm / 60 >= p.targets.sleepH - 1 && sm / 60 <= r.sleepMaxH) ev.push({ label: "Sleep target", xp: r.sleep });
  return { total: ev.reduce((s, e) => s + e.xp, 0), events: ev };
}

export function computeProgress(days: Day[], p: Profile) {
  const xp = days.reduce((s, d) => s + dayXp(d, p).total, 0);
  const level = 1 + Math.floor(Math.sqrt(xp / XP_RULES.levelBase));
  const lo = XP_RULES.levelBase * (level - 1) ** 2, hi = XP_RULES.levelBase * level ** 2;
  return { xp, level, pct: Math.round(((xp - lo) / (hi - lo)) * 100), nextAt: hi };
}

export function streak(days: Day[], today: string) {
  const set = new Set(days.filter(hasData).map((d) => d.date));
  const dt = new Date(today + "T00:00:00Z");
  if (!set.has(dt.toISOString().slice(0, 10))) dt.setUTCDate(dt.getUTCDate() - 1); // today not logged yet doesn't break it
  let n = 0;
  while (set.has(dt.toISOString().slice(0, 10))) { n++; dt.setUTCDate(dt.getUTCDate() - 1); }
  return n;
}
