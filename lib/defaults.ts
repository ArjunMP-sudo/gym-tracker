import type { Day, Profile } from "./schema";
// Editable starting values only; the user changes them in Settings and they are stored in profile.json.
export const DEFAULT_PROFILE: Profile = {
  heightCm: 172,
  goal: "Lean bulk",
  tz: "UTC",
  targets: { kcal: 2500, protein: 100, water: 3000, sleepH: 8 },
};
export const emptyDay = (date: string): Day => ({ date, meals: [], water: [], notes: [], restDay: false });
export const dayPath = (date: string) => `logs/${date.slice(0, 4)}/${date.slice(5, 7)}/${date}.json`;
