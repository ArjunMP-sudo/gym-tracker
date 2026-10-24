import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { StoreError } from "./github";
export const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });
export function fail(e: unknown) {
  if (e instanceof StoreError) return NextResponse.json({ error: e.message, code: e.code }, { status: e.status });
  if (e instanceof ZodError) return bad("Invalid input: " + e.issues.map((i) => `${i.path.join(".")} ${i.message}`).join("; "));
  console.error("unexpected error", e instanceof Error ? e.message : "unknown");
  return bad("Unexpected server error", 500);
}
