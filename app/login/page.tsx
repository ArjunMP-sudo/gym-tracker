"use client";
import { useState } from "react";
import { Bg } from "@/components/Fx";
export default function Login() {
  const [pw, setPw] = useState(""), [err, setErr] = useState(""), [busy, setBusy] = useState(false);
  async function go(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr("");
    const r = await fetch("/api/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ password: pw }) });
    if (r.ok) location.href = "/"; else { setErr((await r.json().catch(() => ({}))).error || "Login failed"); setBusy(false); }
  }
  return (
    <main className="mx-auto flex min-h-screen max-w-sm items-center p-4">
      <Bg />
      <form onSubmit={go} className="card w-full space-y-4">
        <p className="text-sm tracking-[.4em] text-cyan-300" aria-hidden>修行 · TRAINING ARC</p>
        <h1 className="title-x bg-gradient-to-r from-violet-400 via-fuchsia-300 to-cyan-300 bg-clip-text text-5xl leading-none text-transparent">Gym Tracker</h1>
        <div><label htmlFor="pw" className="lbl">Enter the password to begin training</label><input id="pw" type="password" className="inp" value={pw} onChange={(e) => setPw(e.target.value)} autoFocus /></div>
        {err && <p role="alert" className="text-sm text-red-400">{err}</p>}
        <button className="btn w-full font-extrabold uppercase tracking-widest" disabled={busy || !pw}>{busy ? "Powering up…" : "Power up"}</button>
      </form>
    </main>
  );
}
