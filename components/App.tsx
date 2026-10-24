"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bg, Hero, LevelUp } from "@/components/Fx";
import { dayTotals, e1rm, sleepMinutes, waterTotal } from "@/lib/calc";
import { DEFAULT_PROFILE, emptyDay } from "@/lib/defaults";
import { Meal as MealSchema, type Day, type Exercise, type Meal, type Profile } from "@/lib/schema";
import { computeProgress, streak } from "@/lib/xp";

async function api<T>(url: string, method = "GET", body?: unknown): Promise<T> {
  const r = await fetch(url, { method, cache: "no-store", headers: { "content-type": "application/json", "x-requested-with": "ascend" }, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { if (r.status === 401) location.href = "/login"; throw Object.assign(new Error(j.error || "Request failed"), { status: r.status }); }
  return j as T;
}
const uid = () => crypto.randomUUID();
const nowIso = () => new Date().toISOString();
const localDate = () => new Date().toLocaleDateString("en-CA");
type Status = { kind: "idle" | "saving" | "saved" | "failed"; msg?: string };

function Bar({ label, value, max, unit }: { label: string; value: number; max: number; unit: string }) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  return (
    <div>
      <div className="mb-1 flex justify-between text-sm"><span>{label}</span><span className="text-slate-400">{value} / {max} {unit}</span></div>
      <div className="h-2.5 rounded-full bg-white/10" role="progressbar" aria-label={label} aria-valuenow={value} aria-valuemax={max}>
        <div className="fill h-2.5 rounded-full bg-gradient-to-r from-violet-500 to-cyan-400" style={{ width: pct + "%" }} />
      </div>
    </div>
  );
}

function WeightChart({ pts }: { pts: { date: string; w: number }[] }) {
  if (pts.length < 2) return <p className="text-sm text-slate-400">Log at least two weigh-ins to see a trend.</p>;
  const ws = pts.map((p) => p.w), lo = Math.min(...ws) - 0.5, hi = Math.max(...ws) + 0.5;
  const xy = pts.map((p, i) => `${(i / (pts.length - 1)) * 300},${70 - ((p.w - lo) / (hi - lo)) * 60}`).join(" ");
  return (
    <figure>
      <svg viewBox="0 0 300 80" className="w-full" role="img" aria-label={`Weight from ${pts[0].w} kg to ${pts[pts.length - 1].w} kg`}>
        <polyline points={xy} fill="none" stroke="#22d3ee" strokeWidth="2" />
      </svg>
      <figcaption className="text-xs text-slate-400">{pts[0].date}: {pts[0].w} kg → {pts[pts.length - 1].date}: {pts[pts.length - 1].w} kg</figcaption>
    </figure>
  );
}

export default function App() {
  const [tab, setTab] = useState<"today" | "history" | "settings">("today");
  const [profile, setProfile] = useState<Profile>(DEFAULT_PROFILE);
  const [profileSha, setProfileSha] = useState<string | null>(null);
  const [all, setAll] = useState<Day[]>([]);
  const [failedFiles, setFailedFiles] = useState<string[]>([]);
  const [date, setDate] = useState(localDate());
  const [day, setDay] = useState<Day>(emptyDay(localDate()));
  const [sha, setSha] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(localDate().slice(0, 7));
  const [burst, setBurst] = useState<number | null>(null);
  const prevLevel = useRef<number | null>(null);

  const loadAll = useCallback(async () => {
    const r = await api<{ days: Day[]; failed: string[] }>("/api/days");
    setAll(r.days); setFailedFiles(r.failed);
  }, []);
  const loadDay = useCallback(async (d: string) => {
    const r = await api<{ day: Day | null; sha: string | null }>(`/api/day/${d}`);
    setDay(r.day ?? emptyDay(d)); setSha(r.sha); setDirty(false);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const p = await api<{ profile: Profile | null; sha: string | null }>("/api/profile");
        const prof = p.profile ?? { ...DEFAULT_PROFILE, tz: Intl.DateTimeFormat().resolvedOptions().timeZone };
        setProfile(prof); setProfileSha(p.sha);
        await Promise.all([loadAll(), loadDay(localDate())]);
      } catch (e) { setStatus({ kind: "failed", msg: (e as Error).message }); }
      setLoading(false);
    })();
  }, [loadAll, loadDay]);

  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => { if (dirty) e.preventDefault(); };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);

  const edit = (fn: (d: Day) => Day) => { setDay((d) => fn(structuredClone(d))); setDirty(true); setStatus({ kind: "idle" }); };

  async function save() {
    if (status.kind === "saving") return;
    setStatus({ kind: "saving" });
    try {
      const r = await api<{ day: Day; sha: string }>(`/api/day/${day.date}`, "PUT", { day, sha });
      setDay(r.day); setSha(r.sha); setDirty(false); setStatus({ kind: "saved" });
      setAll((a) => [...a.filter((x) => x.date !== r.day.date), r.day].sort((x, y) => x.date.localeCompare(y.date)));
    } catch (e) { setStatus({ kind: "failed", msg: (e as Error).message }); }
  }
  async function pickDate(d: string) {
    if (!d) return;
    if (dirty && !confirm("Discard unsaved changes?")) return;
    setDate(d); setTab("today"); setLoading(true);
    try { await loadDay(d); } catch (e) { setStatus({ kind: "failed", msg: (e as Error).message }); }
    setLoading(false);
  }

  const prog = useMemo(() => computeProgress(all, profile), [all, profile]);
  const today = localDate();
  useEffect(() => {
    if (loading) return;
    if (prevLevel.current !== null && prog.level > prevLevel.current) setBurst(prog.level);
    prevLevel.current = prog.level;
  }, [loading, prog.level]);
  const last = all[all.length - 1];
  const totals = dayTotals(day), water = waterTotal(day), sm = sleepMinutes(day.sleep);
  const weights = all.filter((d) => d.weightKg !== undefined).map((d) => ({ date: d.date, w: d.weightKg as number }));
  const weekAgo = new Date(Date.now() - 6 * 864e5).toLocaleDateString("en-CA");
  const weekWorkouts = all.filter((d) => d.date >= weekAgo && d.workout?.completed).length;
  const todaySaved = all.find((d) => d.date === today);

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4 pb-28">
      <Bg />
      {burst && <LevelUp level={burst} onClose={() => setBurst(null)} />}
      <header className="flex items-center justify-between">
        <h1 className="title-x bg-gradient-to-r from-violet-400 to-cyan-300 bg-clip-text text-2xl text-transparent">Gym Tracker</h1>
        <div aria-live="polite" className="text-sm">
          {status.kind === "saving" && <span className="text-cyan-300">Saving…</span>}
          {status.kind === "saved" && <span className="text-emerald-400">Saved ✓</span>}
          {status.kind === "failed" && <span className="text-red-400">Not saved: {status.msg}</span>}
          {status.kind === "idle" && dirty && <span className="text-amber-300">Unsaved changes</span>}
        </div>
      </header>

      <section className="card space-y-3" aria-label="Character">
        <Hero level={prog.level} xp={prog.xp} pct={prog.pct} nextAt={prog.nextAt} streak={streak(all, today)} />
        <div className="grid grid-cols-3 gap-2 text-center text-sm">
          <div><div className="text-lg font-semibold">{weights.length ? weights[weights.length - 1].w : "—"}</div>kg now{profile.targetWeightKg ? ` / ${profile.targetWeightKg} goal` : ""}</div>
          <div><div className="text-lg font-semibold">{weekWorkouts}</div>workouts (7d)</div>
          <div><div className="text-lg font-semibold">{todaySaved?.workout?.completed ? "Done" : todaySaved?.restDay ? "Rest" : "—"}</div>today</div>
        </div>
        {all.length === 0 && !loading && <p className="text-sm text-slate-400">No history yet. Log today to earn your first XP.</p>}
        <WeightChart pts={weights.slice(-30)} />
        {last && <p className="text-xs text-slate-500">Last saved log: {last.date}. XP is recalculated from saved data, so edits never double-count.</p>}
        {failedFiles.length > 0 && <p role="alert" className="text-sm text-red-400">{failedFiles.length} log file(s) could not be read; stats and exports will be marked incomplete.</p>}
      </section>

      {loading ? <div className="card h-40 animate-pulse" aria-busy="true" /> : tab === "today" ? (
        <Today {...{ day, edit, totals, water, sm, profile, all, save, saving: status.kind === "saving", dirty, pickDate, date }} />
      ) : tab === "history" ? (
        <History {...{ all, month, setMonth, pickDate, date }} />
      ) : (
        <Settings {...{ profile, profileSha, setProfile, setProfileSha }} />
      )}

      <nav className="fixed inset-x-0 bottom-0 border-t border-white/10 bg-black/80 backdrop-blur" aria-label="Main">
        <div className="mx-auto grid max-w-3xl grid-cols-3">
          {(["today", "history", "settings"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)} aria-current={tab === t} className={`min-h-[56px] text-sm capitalize ${tab === t ? "text-cyan-300" : "text-slate-400"}`}>{t}</button>
          ))}
        </div>
      </nav>
    </div>
  );
}

function Num({ label, value, onChange, step = "any" }: { label: string; value: string; onChange: (v: string) => void; step?: string }) {
  return (<div><label className="lbl">{label}<input className="inp mt-1" inputMode="decimal" type="number" min="0" step={step} value={value} onChange={(e) => onChange(e.target.value)} /></label></div>);
}

type TodayProps = {
  day: Day; edit: (fn: (d: Day) => Day) => void; totals: ReturnType<typeof dayTotals>; water: number; sm: number | null;
  profile: Profile; all: Day[]; save: () => void; saving: boolean; dirty: boolean; pickDate: (d: string) => void; date: string;
};

function Today({ day, edit, totals, water, sm, profile, all, save, saving, dirty, pickDate }: TodayProps) {
  const [f, setF] = useState({ name: "", qty: "", unit: "g", kcal: "", protein: "", carbs: "", fat: "", category: "breakfast", estimated: false });
  const [err, setErr] = useState("");
  const [ex, setEx] = useState({ name: "", muscle: "" });
  const [set, setSet] = useState<Record<string, { reps: string; weight: string }>>({});
  const [note, setNote] = useState("");

  function addMeal() {
    const m = MealSchema.safeParse({ id: uid(), name: f.name, qty: Number(f.qty || 0), unit: f.unit, kcal: Number(f.kcal), protein: Number(f.protein || 0), carbs: Number(f.carbs || 0), fat: Number(f.fat || 0), category: f.category, time: nowIso(), estimated: f.estimated });
    if (!m.success || f.kcal === "") return setErr("Enter a name and calories. Nutrition values must be numbers you provide or mark as estimated.");
    setErr(""); edit((d) => ({ ...d, meals: [...d.meals, m.data] }));
    setF({ ...f, name: "", qty: "", kcal: "", protein: "", carbs: "", fat: "" });
  }
  const prev = (name: string): Exercise | undefined => {
    for (let i = all.length - 1; i >= 0; i--) {
      if (all[i].date >= day.date) continue;
      const e = all[i].workout?.completed ? all[i].workout?.exercises.find((x) => x.name.toLowerCase() === name.toLowerCase()) : undefined;
      if (e) return e;
    }
  };
  const w = day.workout;
  const setW = (fn: (w: NonNullable<Day["workout"]>) => void) => edit((d) => { d.workout ??= { id: uid(), name: "Workout", completed: false, exercises: [] }; fn(d.workout); return d; });

  return (
    <div className="space-y-4">
      <div className="card"><label className="lbl" htmlFor="dt">Date</label><input id="dt" type="date" className="inp" value={day.date} max="2100-01-01" onChange={(e) => pickDate(e.target.value)} /></div>

      <section className="card space-y-3"><h2 className="h2x">Body</h2>
        <div className="grid grid-cols-2 gap-3">
          <Num label="Morning weight (kg)" value={day.weightKg?.toString() ?? ""} onChange={(v) => edit((d) => ({ ...d, weightKg: v === "" ? undefined : Number(v) }))} />
          <Num label="Waist (cm)" value={day.measurements?.waistCm?.toString() ?? ""} onChange={(v) => edit((d) => ({ ...d, measurements: { ...d.measurements, waistCm: v === "" ? undefined : Number(v) } }))} />
          <Num label="Chest (cm)" value={day.measurements?.chestCm?.toString() ?? ""} onChange={(v) => edit((d) => ({ ...d, measurements: { ...d.measurements, chestCm: v === "" ? undefined : Number(v) } }))} />
          <Num label="Upper arm (cm)" value={day.measurements?.armCm?.toString() ?? ""} onChange={(v) => edit((d) => ({ ...d, measurements: { ...d.measurements, armCm: v === "" ? undefined : Number(v) } }))} />
        </div>
        {day.weightKg ? <p className="text-xs text-slate-400">BMI {(day.weightKg / (profile.heightCm / 100) ** 2).toFixed(1)} is a rough screening number only; it says nothing about muscle or body composition.</p> : null}
      </section>

      <section className="card space-y-3"><h2 className="h2x">Food</h2>
        <Bar label="Calories" value={totals.kcal} max={profile.targets.kcal} unit="kcal" />
        <Bar label="Protein" value={totals.protein} max={profile.targets.protein} unit="g" />
        <p className="text-xs text-slate-400">Remaining: {Math.max(0, Math.round(profile.targets.kcal - totals.kcal))} kcal, {Math.max(0, Math.round(profile.targets.protein - totals.protein))} g protein. Unlogged meals are treated as unknown, not zero.</p>
        <ul className="space-y-2">{day.meals.map((m: Meal) => (
          <li key={m.id} className="flex items-center justify-between gap-2 rounded-lg bg-white/5 p-2 text-sm">
            <span><b>{m.name}</b> · {m.qty} {m.unit} · {m.kcal} kcal · P{m.protein} C{m.carbs} F{m.fat} · {m.category}{m.estimated ? " · est." : ""}</span>
            <span className="flex shrink-0 gap-1">
              <button className="btn2" onClick={() => edit((d) => ({ ...d, meals: [...d.meals, { ...m, id: uid(), time: nowIso() }] }))} aria-label={`Duplicate ${m.name}`}>⧉</button>
              <button className="btn2" onClick={() => { if (confirm(`Delete ${m.name}?`)) edit((d) => ({ ...d, meals: d.meals.filter((x) => x.id !== m.id) })); }} aria-label={`Delete ${m.name}`}>✕</button>
            </span>
          </li>))}</ul>
        <div className="grid grid-cols-2 gap-2">
          <div className="col-span-2"><label className="lbl">Food name<input className="inp mt-1" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="e.g. Rice (cooked)" /></label></div>
          <Num label="Quantity" value={f.qty} onChange={(v) => setF({ ...f, qty: v })} />
          <div><label className="lbl">Unit<input className="inp mt-1" value={f.unit} onChange={(e) => setF({ ...f, unit: e.target.value })} /></label></div>
          <Num label="Calories (kcal)" value={f.kcal} onChange={(v) => setF({ ...f, kcal: v })} />
          <Num label="Protein (g)" value={f.protein} onChange={(v) => setF({ ...f, protein: v })} />
          <Num label="Carbs (g)" value={f.carbs} onChange={(v) => setF({ ...f, carbs: v })} />
          <Num label="Fat (g)" value={f.fat} onChange={(v) => setF({ ...f, fat: v })} />
          <div><label className="lbl">Meal<select className="inp mt-1" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>{["breakfast", "lunch", "dinner", "snack", "pre-workout", "post-workout"].map((c) => <option key={c}>{c}</option>)}</select></label></div>
          <label className="flex items-center gap-2 pt-6 text-sm"><input type="checkbox" checked={f.estimated} onChange={(e) => setF({ ...f, estimated: e.target.checked })} /> Estimated values</label>
        </div>
        {err && <p role="alert" className="text-sm text-red-400">{err}</p>}
        <button className="btn w-full" onClick={addMeal}>Add food</button>
      </section>

      <section className="card space-y-3"><h2 className="h2x">Workout</h2>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={day.restDay} onChange={(e) => edit((d) => ({ ...d, restDay: e.target.checked }))} /> Rest day (planned recovery counts positively)</label>
        {w ? (<>
          <div><label className="lbl">Session name<input className="inp mt-1" value={w.name} onChange={(e) => setW((x) => { x.name = e.target.value || "Workout"; })} /></label></div>
          {w.exercises.map((e) => { const p = prev(e.name); const est = e1rm(e.sets); return (
            <div key={e.id} className="rounded-lg bg-white/5 p-3 text-sm">
              <div className="flex justify-between"><b>{e.name} <span className="font-normal text-slate-400">{e.muscle}</span></b>
                <button className="btn2" aria-label={`Remove ${e.name}`} onClick={() => { if (confirm(`Remove ${e.name}?`)) setW((x) => { x.exercises = x.exercises.filter((y) => y.id !== e.id); }); }}>✕</button></div>
              {p && <p className="text-xs text-slate-400">Last time: {p.sets.map((s) => `${s.weight}${s.unit}×${s.reps}`).join(", ")}</p>}
              {e.sets.map((s, i) => (<div key={i} className="flex items-center justify-between py-1"><span>Set {i + 1}: {s.weight} {s.unit} × {s.reps}</span>
                <button className="btn2" aria-label={`Remove set ${i + 1}`} onClick={() => setW((x) => { const t = x.exercises.find((y) => y.id === e.id); t?.sets.splice(i, 1); })}>−</button></div>))}
              {est !== null && <p className="text-xs text-slate-400">Estimated 1RM (estimate, not a tested max): {est} {e.sets[0].unit}</p>}
              <div className="mt-2 flex gap-2">
                <input className="inp" inputMode="decimal" placeholder="kg" aria-label="Weight" value={set[e.id]?.weight ?? ""} onChange={(ev) => setSet({ ...set, [e.id]: { reps: set[e.id]?.reps ?? "", weight: ev.target.value } })} />
                <input className="inp" inputMode="numeric" placeholder="reps" aria-label="Reps" value={set[e.id]?.reps ?? ""} onChange={(ev) => setSet({ ...set, [e.id]: { weight: set[e.id]?.weight ?? "", reps: ev.target.value } })} />
                <button className="btn2" onClick={() => { const s = set[e.id]; const reps = Number(s?.reps), weight = Number(s?.weight ?? 0); if (!(reps > 0) || weight < 0 || Number.isNaN(weight)) return; setW((x) => { x.exercises.find((y) => y.id === e.id)?.sets.push({ reps, weight, unit: "kg" }); }); setSet({ ...set, [e.id]: { reps: "", weight: s?.weight ?? "" } }); }}>+ Set</button>
              </div>
            </div>); })}
          <div className="flex gap-2">
            <input className="inp" placeholder="Exercise" aria-label="Exercise name" value={ex.name} onChange={(e) => setEx({ ...ex, name: e.target.value })} />
            <input className="inp" placeholder="Muscle" aria-label="Muscle group" value={ex.muscle} onChange={(e) => setEx({ ...ex, muscle: e.target.value })} />
            <button className="btn2" onClick={() => { if (!ex.name.trim()) return; setW((x) => { x.exercises.push({ id: uid(), name: ex.name.trim(), muscle: ex.muscle.trim(), sets: [] }); }); setEx({ name: "", muscle: "" }); }}>Add</button>
          </div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={w.completed} onChange={(e) => setW((x) => { x.completed = e.target.checked; })} /> I completed this workout (planned sessions don&apos;t count until confirmed)</label>
          <button className="btn2" onClick={() => { if (confirm("Remove this workout from the day?")) edit((d) => ({ ...d, workout: undefined })); }}>Remove workout</button>
        </>) : <button className="btn2" onClick={() => setW(() => {})}>+ Add workout</button>}
      </section>

      <section className="card space-y-3"><h2 className="h2x">Water</h2>
        <Bar label="Water" value={water} max={profile.targets.water} unit="ml" />
        <div className="flex gap-2">{[250, 500, 750].map((ml) => <button key={ml} className="btn2 flex-1" onClick={() => edit((d) => ({ ...d, water: [...d.water, { id: uid(), ml, time: nowIso() }] }))}>+{ml} ml</button>)}</div>
        <ul className="text-sm text-slate-300">{day.water.map((x) => <li key={x.id} className="flex items-center justify-between py-1">{x.ml} ml · {new Date(x.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          <button className="btn2" aria-label="Delete water entry" onClick={() => edit((d) => ({ ...d, water: d.water.filter((y) => y.id !== x.id) }))}>✕</button></li>)}</ul>
      </section>

      <section className="card space-y-3"><h2 className="h2x">Sleep &amp; recovery</h2>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="lbl">Bedtime<input type="time" className="inp mt-1" value={day.sleep?.bedtime ?? ""} onChange={(e) => edit((d) => ({ ...d, sleep: e.target.value ? { bedtime: e.target.value, wake: d.sleep?.wake ?? e.target.value, quality: d.sleep?.quality } : undefined }))} /></label></div>
          <div><label className="lbl">Wake up<input type="time" className="inp mt-1" value={day.sleep?.wake ?? ""} disabled={!day.sleep} onChange={(e) => edit((d) => ({ ...d, sleep: d.sleep ? { ...d.sleep, wake: e.target.value } : undefined }))} /></label></div>
          <div><label className="lbl">Sleep quality (1–5)<select className="inp mt-1" disabled={!day.sleep} value={day.sleep?.quality ?? ""} onChange={(e) => edit((d) => ({ ...d, sleep: d.sleep ? { ...d.sleep, quality: e.target.value ? Number(e.target.value) : undefined } : undefined }))}><option value="">–</option>{[1, 2, 3, 4, 5].map((n) => <option key={n}>{n}</option>)}</select></label></div>
          <div><label className="lbl">Soreness (1–5)<select className="inp mt-1" disabled={!day.sleep} value={day.sleep?.soreness ?? ""} onChange={(e) => edit((d) => ({ ...d, sleep: d.sleep ? { ...d.sleep, soreness: e.target.value ? Number(e.target.value) : undefined } : undefined }))}><option value="">–</option>{[1, 2, 3, 4, 5].map((n) => <option key={n}>{n}</option>)}</select></label></div>
        </div>
        {day.sleep && <p className="text-sm text-slate-300">{sm === null ? "Bedtime and wake time are identical; enter different times." : `Duration: ${Math.floor(sm / 60)} h ${sm % 60} min (target ${profile.targets.sleepH} h)`}</p>}
      </section>

      <section className="card space-y-3"><h2 className="h2x">Notes</h2>
        <ul className="space-y-2 text-sm">{day.notes.map((n) => <li key={n.id} className="flex justify-between gap-2 rounded-lg bg-white/5 p-2"><span>{n.text}</span><button className="btn2" aria-label="Delete note" onClick={() => { if (confirm("Delete this note?")) edit((d) => ({ ...d, notes: d.notes.filter((x) => x.id !== n.id) })); }}>✕</button></li>)}</ul>
        <textarea className="inp" rows={2} aria-label="New note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Motivation, appetite, energy, anything…" />
        <button className="btn2" onClick={() => { if (!note.trim()) return; edit((d) => ({ ...d, notes: [...d.notes, { id: uid(), time: nowIso(), text: note.trim() }] })); setNote(""); }}>Add note</button>
      </section>

      <div className="sticky bottom-16"><button className="btn w-full shadow-lg" disabled={saving || !dirty} onClick={save}>{saving ? "Saving…" : dirty ? "Save day" : "All changes saved"}</button></div>
    </div>
  );
}

function History({ all, month, setMonth, pickDate, date }: { all: Day[]; month: string; setMonth: (m: string) => void; pickDate: (d: string) => void; date: string }) {
  const days = all.filter((d) => d.date.startsWith(month)).reverse();
  const dl = (q: string) => `/api/export?${q}`;
  return (
    <div className="space-y-4">
      <section className="card space-y-3"><h2 className="h2x">Export</h2>
        <p className="text-xs text-slate-400">Plain-text files generated from your saved GitHub records. Each file ends with a STATUS line stating whether it is complete.</p>
        <a className="btn2 block text-center" href={dl(`scope=day&value=${date}`)} download>Download this day ({date}) (.txt)</a>
        <a className="btn2 block text-center" href={dl(`scope=month&value=${month}`)} download>Download {month} (.txt)</a>
        <a className="btn block text-center" href={dl("scope=all")} download>Download All-Time History (.txt)</a>
      </section>
      <section className="card space-y-3"><h2 className="h2x">Calendar log</h2>
        <label className="lbl">Month<input type="month" className="inp mt-1" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} /></label>
        {days.length === 0 && <p className="text-sm text-slate-400">No saved logs in this month.</p>}
        <ul className="space-y-2">{days.map((d) => { const t = dayTotals(d); return (
          <li key={d.date}><button className="btn2 w-full text-left" onClick={() => pickDate(d.date)}>
            <b>{d.date}</b> {d.workout?.completed ? "🏋️ " : d.restDay ? "😴 " : ""}{d.meals.length ? `· ${t.kcal} kcal · ${t.protein} g P ` : ""}{d.weightKg ? `· ${d.weightKg} kg` : ""}
          </button></li>); })}</ul>
      </section>
    </div>
  );
}

function Settings({ profile, profileSha, setProfile, setProfileSha }: { profile: Profile; profileSha: string | null; setProfile: (p: Profile) => void; setProfileSha: (s: string) => void }) {
  const [p, setP] = useState(profile);
  const [msg, setMsg] = useState("");
  const t = p.targets;
  async function save() {
    setMsg("Saving…");
    try { const r = await api<{ profile: Profile; sha: string }>("/api/profile", "PUT", { profile: p, sha: profileSha }); setProfile(r.profile); setProfileSha(r.sha); setMsg("Saved ✓"); }
    catch (e) { setMsg("Not saved: " + (e as Error).message); }
  }
  const nv = (v: string) => Number(v);
  return (
    <section className="card space-y-3"><h2 className="h2x">Profile &amp; targets</h2>
      <div className="grid grid-cols-2 gap-3">
        <Num label="Height (cm)" value={String(p.heightCm)} onChange={(v) => setP({ ...p, heightCm: nv(v) })} />
        <Num label="Target weight (kg)" value={p.targetWeightKg?.toString() ?? ""} onChange={(v) => setP({ ...p, targetWeightKg: v ? nv(v) : undefined })} />
        <Num label="Calories / day" value={String(t.kcal)} onChange={(v) => setP({ ...p, targets: { ...t, kcal: nv(v) } })} />
        <Num label="Protein g / day" value={String(t.protein)} onChange={(v) => setP({ ...p, targets: { ...t, protein: nv(v) } })} />
        <Num label="Water ml / day" value={String(t.water)} onChange={(v) => setP({ ...p, targets: { ...t, water: nv(v) } })} />
        <Num label="Sleep h / night" value={String(t.sleepH)} onChange={(v) => setP({ ...p, targets: { ...t, sleepH: nv(v) } })} />
        <div className="col-span-2"><label className="lbl">Goal<input className="inp mt-1" value={p.goal} onChange={(e) => setP({ ...p, goal: e.target.value })} /></label></div>
        <div className="col-span-2"><label className="lbl">Timezone<input className="inp mt-1" value={p.tz} onChange={(e) => setP({ ...p, tz: e.target.value })} /></label></div>
      </div>
      <p className="text-xs text-slate-400">Starting targets are placeholders, not recommendations. Set values that suit you (ideally with a qualified coach or dietitian).</p>
      <button className="btn w-full" onClick={save}>Save settings</button>
      <p aria-live="polite" className="text-sm">{msg}</p>
      <button className="btn2 w-full" onClick={async () => { await api("/api/logout", "POST"); location.href = "/login"; }}>Sign out</button>
    </section>
  );
}
