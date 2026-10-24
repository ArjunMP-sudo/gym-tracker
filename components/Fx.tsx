"use client";
import { useEffect, useRef, useState } from "react";

export function Bg() {
  return (
    <div className="bg-fx" aria-hidden>
      <ClickSparks />
      {Array.from({ length: 16 }, (_, i) => (
        <span key={i} className="ember" style={{ left: `${(i * 37) % 100}%`, animationDuration: `${6 + (i % 5) * 2}s`, animationDelay: `${(i * 0.7) % 6}s` }} />
      ))}
    </div>
  );
}

export const TIERS = [
  { min: 1, name: "Rookie Fighter", jp: "新人", c: "#94a3b8", c2: "#38bdf8" },
  { min: 3, name: "Awakened", jp: "覚醒", c: "#22d3ee", c2: "#6366f1" },
  { min: 5, name: "Ascended", jp: "昇華", c: "#a78bfa", c2: "#e879f9" },
  { min: 8, name: "Overdrive", jp: "超越", c: "#fbbf24", c2: "#f97316" },
  { min: 12, name: "Limit Break", jp: "限界突破", c: "#f0abfc", c2: "#ffffff" },
];
export const tierFor = (level: number) => [...TIERS].reverse().find((t) => level >= t.min) ?? TIERS[0];

export function useCountUp(target: number, ms = 900) {
  const [v, setV] = useState(0);
  const from = useRef(0);
  useEffect(() => {
    const start = from.current;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setV(target); from.current = target; return; }
    let raf = 0; const t0 = performance.now();
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / ms);
      setV(Math.round(start + (target - start) * (1 - (1 - k) ** 3)));
      if (k < 1) raf = requestAnimationFrame(step); else from.current = target;
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return v;
}
export function Count({ n }: { n: number }) { const v = useCountUp(n, 700); return <>{v}</>; }

function ClickSparks() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const h = (e: PointerEvent) => {
      for (let i = 0; i < 8; i++) {
        const s = document.createElement("span");
        const a = (i / 8) * Math.PI * 2, d = 24 + Math.random() * 20;
        s.className = "spark"; s.style.left = e.clientX + "px"; s.style.top = e.clientY + "px";
        s.style.setProperty("--dx", Math.cos(a) * d + "px"); s.style.setProperty("--dy", Math.sin(a) * d + "px");
        document.body.appendChild(s); setTimeout(() => s.remove(), 600);
      }
    };
    document.addEventListener("pointerdown", h);
    return () => document.removeEventListener("pointerdown", h);
  }, []);
  return null;
}

function Fighter({ c, c2 }: { c: string; c2: string }) {
  const body = { fill: "#0b0b14", stroke: c2, strokeWidth: 2, strokeLinejoin: "round" as const };
  return (
    <svg viewBox="0 0 200 240" className="h-44 w-36 shrink-0" role="img" aria-label="Your fighter, glowing with aura">
      <defs>
        <radialGradient id="ag" cx="50%" cy="55%" r="55%"><stop offset="0" stopColor={c2} stopOpacity=".85" /><stop offset="1" stopColor={c} stopOpacity="0" /></radialGradient>
        <filter id="bl"><feGaussianBlur stdDeviation="4" /></filter>
      </defs>
      <ellipse className="aura" cx="100" cy="135" rx="88" ry="108" fill="url(#ag)" />
      <path className="aura2" d="M100 8 L120 72 L142 28 L146 104 L176 70 L152 156 L48 156 L24 70 L54 104 L58 28 L80 72 Z" fill={c} opacity=".4" filter="url(#bl)" />
      <path d="M72 100 L128 100 L140 172 L60 172 Z" {...body} />
      <path d="M72 106 L42 124 L34 94 M128 106 L158 124 L166 94" fill="none" stroke={c2} strokeWidth="12" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M72 106 L42 124 L34 94 M128 106 L158 124 L166 94" fill="none" stroke="#0b0b14" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M82 172 L72 230 M118 172 L128 230" fill="none" stroke={c2} strokeWidth="14" strokeLinecap="round" />
      <path d="M82 172 L72 230 M118 172 L128 230" fill="none" stroke="#0b0b14" strokeWidth="10" strokeLinecap="round" />
      <path d="M72 66 L60 22 L86 46 L94 10 L108 44 L128 16 L130 66 Z" {...body} />
      <circle cx="100" cy="78" r="21" {...body} />
      <path d="M86 76 L98 80 M114 76 L102 80" stroke={c2} strokeWidth="3.5" strokeLinecap="round" />
      <path d="M92 68 L98 70 M108 68 L102 70" stroke={c2} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function Hero({ level, xp, pct, nextAt, streak }: { level: number; xp: number; pct: number; nextAt: number; streak: number }) {
  const t = tierFor(level);
  const power = useCountUp(xp * 100 + streak * 50);
  return (
    <div className="flex items-center gap-3">
      <div className="bob relative shrink-0">
        <svg className="spin absolute inset-0 m-auto h-40 w-40" viewBox="0 0 100 100" aria-hidden><circle cx="50" cy="50" r="46" fill="none" stroke={t.c} strokeWidth="1" strokeDasharray="4 6" opacity=".7" /></svg>
        <Fighter c={t.c} c2={t.c2} />
      </div>
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex items-baseline gap-2"><span className="title-x text-4xl" style={{ color: t.c2 }}>Lv {level}</span><span className="text-xl" aria-hidden style={{ color: t.c }}>{t.jp}</span></div>
        <div className="text-sm font-bold uppercase tracking-widest" style={{ color: t.c }}>{t.name}</div>
        <div className="rounded border border-cyan-400/30 bg-black/50 px-2 py-1 font-mono text-sm text-cyan-300" aria-label={`Power level ${power}`}>
          SCOUTER <span className="text-lg font-bold">{power.toLocaleString()}</span> PL
        </div>
        <div className="h-3.5 rounded-sm bg-white/10" role="progressbar" aria-label="XP to next level" aria-valuenow={pct} aria-valuemax={100}>
          <div className="ki fill h-3.5 rounded-sm" style={{ width: Math.max(pct, 3) + "%", background: `linear-gradient(90deg, ${t.c}, ${t.c2})`, boxShadow: `0 0 14px ${t.c2}` }} />
        </div>
        <div className="text-xs text-slate-400">{xp} / {nextAt} XP · <span className="flame">🔥</span> {streak}-day streak</div>
      </div>
    </div>
  );
}

export function LevelUp({ level, onClose }: { level: number; onClose: () => void }) {
  const t = tierFor(level);
  useEffect(() => { const id = setTimeout(onClose, 3200); return () => clearTimeout(id); }, [onClose]);
  return (
    <div role="alert" onClick={onClose} className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
      <span className="ring" /><span className="ring" style={{ animationDelay: ".5s" }} />
      <div className="burst relative text-center">
        <div className="title-x text-6xl" style={{ color: t.c2 }}>LEVEL UP!</div>
        <div className="mt-2 text-3xl font-black text-white">Lv {level}</div>
        <div className="mt-1 text-lg font-bold uppercase tracking-widest" style={{ color: t.c }}>{t.name} {t.jp}</div>
      </div>
    </div>
  );
}
