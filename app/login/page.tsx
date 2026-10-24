"use client";
import { useState } from "react";
export default function Login() {
  const [pw, setPw] = useState(""), [err, setErr] = useState(""), [busy, setBusy] = useState(false);
  async function go(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr("");
    const r = await fetch("/api/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ password: pw }) });
    if (r.ok) location.href = "/"; else { setErr((await r.json().catch(() => ({}))).error || "Login failed"); setBusy(false); }
  }
  return (
    <main className="mx-auto flex min-h-screen max-w-sm items-center p-4">
      <form onSubmit={go} className="card w-full space-y-4">
        <h1 className="bg-gradient-to-r from-violet-400 to-cyan-300 bg-clip-text text-3xl font-bold text-transparent">Gym Tracker</h1>
        <p className="text-sm text-slate-400">Sign in to continue</p>
        <div><label htmlFor="pw" className="lbl">Password</label><input id="pw" type="password" className="inp" value={pw} onChange={(e) => setPw(e.target.value)} autoFocus /></div>
        {err && <p role="alert" className="text-sm text-red-400">{err}</p>}
        <button className="btn w-full" disabled={busy || !pw}>{busy ? "Signing in…" : "Enter"}</button>
      </form>
    </main>
  );
}
