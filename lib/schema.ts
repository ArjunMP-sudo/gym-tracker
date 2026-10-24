import { z } from "zod";

export const dateStr = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((s) => {
    const d = new Date(s + "T00:00:00Z");
    return !isNaN(+d) && d.toISOString().slice(0, 10) === s;
  }, "Invalid calendar date");

const id = z.string().min(1).max(64);
const n = (max: number) => z.number().finite().min(0).max(max);
const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

export const Meal = z.object({
  id,
  name: z.string().trim().min(1).max(120),
  qty: n(100000),
  unit: z.string().max(20),
  kcal: n(10000),
  protein: n(1000),
  carbs: n(2000),
  fat: n(1000),
  category: z.enum(["breakfast", "lunch", "dinner", "snack", "pre-workout", "post-workout"]),
  time: z.string().max(40),
  estimated: z.boolean(),
  notes: z.string().max(500).optional(),
});

export const WorkoutSet = z.object({
  reps: n(1000),
  weight: n(2000),
  unit: z.enum(["kg", "lb"]),
  rpe: z.number().min(1).max(10).optional(),
  warmup: z.boolean().optional(),
});

export const Exercise = z.object({
  id,
  name: z.string().trim().min(1).max(120),
  muscle: z.string().max(40),
  equipment: z.string().max(60).optional(),
  notes: z.string().max(500).optional(),
  sets: z.array(WorkoutSet).max(30),
});

export const Workout = z.object({
  id,
  name: z.string().trim().min(1).max(120),
  completed: z.boolean(), // only true after the user confirms
  durationMin: n(600).optional(),
  exercises: z.array(Exercise).max(40),
  notes: z.string().max(1000).optional(),
});

export const Day = z.object({
  date: dateStr,
  weightKg: z.number().min(20).max(400).optional(),
  measurements: z
    .object({
      waistCm: n(300).optional(), chestCm: n(300).optional(), armCm: n(150).optional(),
      thighCm: n(200).optional(), bodyFatPct: z.number().min(2).max(70).optional(),
    })
    .optional(),
  meals: z.array(Meal).max(200),
  workout: Workout.optional(),
  restDay: z.boolean(),
  steps: n(200000).optional(),
  water: z.array(z.object({ id, ml: z.number().min(1).max(5000), time: z.string().max(40) })).max(200),
  sleep: z
    .object({
      bedtime: hhmm, wake: hhmm,
      quality: z.number().int().min(1).max(5).optional(),
      energy: z.number().int().min(1).max(5).optional(),
      soreness: z.number().int().min(1).max(5).optional(),
      recovery: z.number().int().min(1).max(5).optional(),
    })
    .optional(),
  notes: z.array(z.object({ id, time: z.string().max(40), text: z.string().trim().min(1).max(2000) })).max(100),
  updatedAt: z.string().optional(),
});

export const Profile = z.object({
  heightCm: z.number().min(50).max(260),
  targetWeightKg: z.number().min(20).max(400).optional(),
  goal: z.string().max(80),
  tz: z.string().max(60),
  targets: z.object({
    kcal: z.number().min(500).max(10000),
    protein: z.number().min(10).max(500),
    water: z.number().min(250).max(10000),
    sleepH: z.number().min(3).max(14),
  }),
});

export type Meal = z.infer<typeof Meal>;
export type Exercise = z.infer<typeof Exercise>;
export type Workout = z.infer<typeof Workout>;
export type Day = z.infer<typeof Day>;
export type Profile = z.infer<typeof Profile>;
