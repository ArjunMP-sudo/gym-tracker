import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getFile, putFile } from "./github";

beforeEach(() => { process.env.GITHUB_TOKEN = "t"; process.env.GITHUB_OWNER = "o"; process.env.GITHUB_REPO = "r"; });
afterEach(() => vi.unstubAllGlobals());
const resp = (status: number, body: unknown = {}, headers: Record<string, string> = {}) => new Response(JSON.stringify(body), { status, headers });

describe("github store", () => {
  it("reports conflicts instead of overwriting", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => resp(409)));
    await expect(putFile("logs/a.json", {}, "oldsha", "m")).rejects.toMatchObject({ code: "conflict", status: 409 });
  });
  it("returns null for missing files", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => resp(404)));
    expect(await getFile("x.json")).toBeNull();
  });
  it("limits retries on network failure", async () => {
    const f = vi.fn(async () => { throw new Error("down"); });
    vi.stubGlobal("fetch", f);
    await expect(getFile("x.json")).rejects.toMatchObject({ code: "network" });
    expect(f).toHaveBeenCalledTimes(3);
  });
  it("surfaces rate limits and bad credentials", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => resp(403, {}, { "x-ratelimit-remaining": "0" })));
    await expect(getFile("x.json")).rejects.toMatchObject({ code: "rate_limit" });
    vi.stubGlobal("fetch", vi.fn(async () => resp(401)));
    await expect(getFile("x.json")).rejects.toMatchObject({ code: "auth" });
  });
});
