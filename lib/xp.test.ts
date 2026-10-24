import { describe, expect, it } from "vitest";
import { dayTotals, sleepMinutes } from "./calc";
import { DEFAULT_PROFILE, emptyDay } from "./defaults";
import { buildExport } from "./export";
import { computeProgress, dayXp, streak } from "./xp";

const p = DEFAULT_PROFILE;
const meal = (kcal: number, protein: number) => ({ id: "m" + kcal, name: "x", qty: 1, unit: "g", kcal, protein, carbs: 0, fat: 0, category: "lunch" as const, time: "t", estimated: false });

describe("xp", () => {
  it("is deterministic (re-saving gives no extra XP)", () => {
    const d = { ...emptyDay("2026-10-23"), meals: [meal(2500, 120)] };
    expect(dayXp(d, p).total).toBe(dayXp(structuredClone(d), p).total);
    expect(computeProgress([d], p).xp).toBe(computeProgress([d, d].slice(0, 1), p).xp);
  });
  it("gives no nutrition XP for undereating", () => {
    const d = { ...emptyDay("2026-10-23"), meals: [meal(900, 150)] };
    expect(dayXp(d, p).events.some((e) => e.label === "Nutrition target")).toBe(false);
  });
  it("planned workout earns nothing until confirmed", () => {
    const w = { id: "w", name: "A", completed: false, exercises: [{ id: "e", name: "Press", muscle: "chest", sets: [{ reps: 8, weight: 20, unit: "kg" as const }] }] };
    expect(dayXp({ ...emptyDay("2026-10-23"), workout: w }, p).events.some((e) => e.label === "Workout completed")).toBe(false);
    expect(dayXp({ ...emptyDay("2026-10-23"), workout: { ...w, completed: true } }, p).events.some((e) => e.label === "Workout completed")).toBe(true);
  });
  it("counts streaks across month boundaries", () => {
    const ds = ["2026-10-31", "2026-11-01", "2026-11-02"].map((d) => ({ ...emptyDay(d), restDay: true }));
    expect(streak(ds, "2026-11-02")).toBe(3);
  });
});

describe("calc + export", () => {
  it("sums nutrition without float drift", () => {
    const d = { ...emptyDay("2026-10-23"), meals: [meal(0.1, 0.1), meal(0.2, 0.2)] };
    expect(dayTotals(d).kcal).toBe(0.3);
  });
  it("handles sleep across midnight", () => {
    expect(sleepMinutes({ bedtime: "23:30", wake: "06:30" })).toBe(420);
  });
  it("exports every record and marks completeness", () => {
    const days = [{ ...emptyDay("2026-10-23"), meals: [meal(500, 20)] }, { ...emptyDay("2026-10-24"), restDay: true }];
    const t = buildExport({ days, profile: p, title: "X", exportedAt: "now", failed: [], sourceFiles: 2 });
    expect(t).toContain("DAILY LOG — 2026-10-23");
    expect(t).toContain("DAILY LOG — 2026-10-24");
    expect(t).toContain("Meals/food entries: 1");
    expect(t).toContain("STATUS: COMPLETE");
  });
  it("labels partial exports incomplete and handles empty history", () => {
    expect(buildExport({ days: [], profile: p, title: "X", exportedAt: "now", failed: [], sourceFiles: 0 })).toContain("No records were found");
    const t = buildExport({ days: [emptyDay("2026-10-23")], profile: p, title: "X", exportedAt: "now", failed: ["logs/a.json"], sourceFiles: 2 });
    expect(t).toContain("INCOMPLETE");
  });
});
