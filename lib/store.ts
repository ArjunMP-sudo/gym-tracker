import { Day } from "./schema";

// Storage: Upstash Redis (add it in Vercel > Storage; env vars are injected automatically).
// Each record is one key holding {d: data, v: version}. Writes are compare-and-set, so a stale save never overwrites newer data.
export class StoreError extends Error {
  constructor(message: string, public status = 502, public code = "store_error") { super(message); }
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
function cfg() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) throw new StoreError("Storage is not connected. In Vercel: Storage > Create > Upstash Redis > connect to this project, then redeploy.", 500, "config");
  return { url, token };
}

async function redis(cmd: (string | number)[], attempt = 0): Promise<unknown> {
  const { url, token } = cfg();
  let res: Response;
  try {
    res = await fetch(url, { method: "POST", cache: "no-store", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(cmd) });
  } catch {
    if (attempt < 2) { await sleep(300 * 2 ** attempt); return redis(cmd, attempt + 1); }
    throw new StoreError("Could not reach the database. Check your connection and try again.", 503, "network");
  }
  if (res.status >= 500) {
    if (attempt < 2) { await sleep(300 * 2 ** attempt); return redis(cmd, attempt + 1); }
    throw new StoreError("Database is unavailable right now", 503, "unavailable");
  }
  if (res.status === 401 || res.status === 403) throw new StoreError("Database credentials are invalid. Reconnect the storage in Vercel.", 500, "auth");
  if (res.status === 429) throw new StoreError("Database rate limit reached. Try again shortly.", 429, "rate_limit");
  const j = (await res.json().catch(() => ({}))) as { result?: unknown; error?: string };
  if (!res.ok || j.error) throw new StoreError("Database error: " + (j.error ?? res.status), 502);
  return j.result;
}

const key = (p: string) => "gt:" + p;
const INDEX = "gt:index";

export async function getFile(path: string): Promise<{ data: unknown; sha: string } | null> {
  const r = await redis(["GET", key(path)]);
  if (r === null || r === undefined) return null;
  try { const o = JSON.parse(String(r)) as { d: unknown; v: number }; return { data: o.d, sha: String(o.v) }; }
  catch { throw new StoreError(`Stored record ${path} is corrupt`, 500, "corrupt"); }
}

const CAS = `local cur = redis.call('GET', KEYS[1])
if cur then
  if tostring(cjson.decode(cur).v) ~= ARGV[1] then return 0 end
else
  if ARGV[1] ~= 'new' then return 0 end
end
redis.call('SET', KEYS[1], ARGV[2])
redis.call('SADD', KEYS[2], ARGV[3])
return 1`;

/** sha undefined = create new (fails if it already exists). Otherwise must match the stored version, else conflict. */
export async function putFile(path: string, data: unknown, sha: string | undefined, _message?: string): Promise<string> {
  const expected = sha ?? "new";
  const next = sha ? Number(sha) + 1 : 1;
  if (!Number.isFinite(next)) throw new StoreError("Invalid version token", 400, "bad_version");
  const ok = await redis(["EVAL", CAS, 2, key(path), INDEX, expected, JSON.stringify({ d: data, v: next }), path]);
  if (ok !== 1) throw new StoreError("This record was changed elsewhere. Reload to see the latest version; your edits are still on screen.", 409, "conflict");
  return String(next);
}

export async function listFiles(prefix: string): Promise<string[]> {
  const r = (await redis(["SMEMBERS", INDEX])) as string[];
  return (r ?? []).filter((p) => p.startsWith(prefix)).sort();
}

export async function loadDays(prefix = "") {
  const paths = (await listFiles("logs/" + prefix)).filter((p) => p.endsWith(".json"));
  const days: Day[] = [], failed: string[] = [];
  let i = 0;
  await Promise.all(Array.from({ length: 8 }, async () => {
    while (i < paths.length) {
      const p = paths[i++];
      try {
        const f = await getFile(p);
        const parsed = Day.safeParse(f?.data);
        if (parsed.success) days.push(parsed.data); else failed.push(p);
      } catch { failed.push(p); }
    }
  }));
  days.sort((a, b) => a.date.localeCompare(b.date));
  return { days, failed: failed.sort(), sourceFiles: paths.length };
}
