import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getFile, putFile } from "./store";

beforeEach(() => { process.env.KV_REST_API_URL = "https://db.test"; process.env.KV_REST_API_TOKEN = "t"; });
afterEach(() => vi.unstubAllGlobals());
const resp = (status: number, body: unknown = {}) => new Response(JSON.stringify(body), { status });

describe("store", () => {
  it("reports conflicts instead of overwriting", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => resp(200, { result: 0 })));
    await expect(putFile("logs/a.json", {}, "1")).rejects.toMatchObject({ code: "conflict", status: 409 });
  });
  it("returns the next version on success", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => resp(200, { result: 1 })));
    expect(await putFile("logs/a.json", {}, "1")).toBe("2");
    expect(await putFile("logs/b.json", {}, undefined)).toBe("1");
  });
  it("reads stored data with its version, null when missing", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => resp(200, { result: JSON.stringify({ d: { a: 1 }, v: 3 }) })));
    expect(await getFile("x")).toEqual({ data: { a: 1 }, sha: "3" });
    vi.stubGlobal("fetch", vi.fn(async () => resp(200, { result: null })));
    expect(await getFile("x")).toBeNull();
  });
  it("limits retries on network failure", async () => {
    const f = vi.fn(async () => { throw new Error("down"); });
    vi.stubGlobal("fetch", f);
    await expect(getFile("x")).rejects.toMatchObject({ code: "network" });
    expect(f).toHaveBeenCalledTimes(3);
  });
  it("surfaces bad credentials and rate limits", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => resp(401)));
    await expect(getFile("x")).rejects.toMatchObject({ code: "auth" });
    vi.stubGlobal("fetch", vi.fn(async () => resp(429)));
    await expect(getFile("x")).rejects.toMatchObject({ code: "rate_limit" });
  });
});
