import { Day } from "./schema";

export class StoreError extends Error {
  constructor(message: string, public status = 502, public code = "store_error") { super(message); }
}
const API = "https://api.github.com";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
function cfg() {
  const token = process.env.GITHUB_TOKEN, owner = process.env.GITHUB_OWNER, repo = process.env.GITHUB_REPO;
  if (!token || !owner || !repo) throw new StoreError("GitHub storage is not configured on the server", 500, "config");
  return { token, owner, repo, branch: process.env.GITHUB_BRANCH || "main" };
}

async function gh(path: string, init: RequestInit = {}, attempt = 0): Promise<Response> {
  const { token } = cfg();
  let res: Response;
  try {
    res = await fetch(API + path, {
      ...init, cache: "no-store",
      headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", "Content-Type": "application/json" },
    });
  } catch {
    if (attempt < 2) { await sleep(300 * 2 ** attempt); return gh(path, init, attempt + 1); }
    throw new StoreError("Could not reach GitHub. Check your connection and try again.", 503, "network");
  }
  if (res.status >= 500) {
    if (attempt < 2) { await sleep(300 * 2 ** attempt); return gh(path, init, attempt + 1); }
    throw new StoreError("GitHub is unavailable right now", 503, "unavailable");
  }
  if (res.status === 401) throw new StoreError("GitHub token is invalid or expired. Rotate it in Vercel env vars.", 500, "auth");
  if (res.status === 429 || (res.status === 403 && res.headers.get("x-ratelimit-remaining") === "0"))
    throw new StoreError("GitHub rate limit reached. Try again in a few minutes.", 429, "rate_limit");
  if (res.status === 403) throw new StoreError("GitHub token lacks permission for this repository (needs Contents: read/write)", 500, "forbidden");
  return res;
}

const enc = (p: string) => p.split("/").map(encodeURIComponent).join("/");

export async function getFile(path: string): Promise<{ data: unknown; sha: string } | null> {
  const { owner, repo, branch } = cfg();
  const res = await gh(`/repos/${owner}/${repo}/contents/${enc(path)}?ref=${encodeURIComponent(branch)}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new StoreError(`GitHub returned ${res.status} while reading`, 502);
  const j = (await res.json()) as { content: string; sha: string };
  try { return { data: JSON.parse(Buffer.from(j.content, "base64").toString("utf8")), sha: j.sha }; }
  catch { throw new StoreError(`Stored file ${path} is not valid JSON`, 500, "corrupt"); }
}

/** Creates (sha undefined) or updates (sha required). Never overwrites a file you haven't seen: a stale/missing sha => conflict. */
export async function putFile(path: string, data: unknown, sha: string | undefined, message: string): Promise<string> {
  const { owner, repo, branch } = cfg();
  const body = { message, branch, content: Buffer.from(JSON.stringify(data, null, 2) + "\n").toString("base64"), ...(sha ? { sha } : {}) };
  const res = await gh(`/repos/${owner}/${repo}/contents/${enc(path)}`, { method: "PUT", body: JSON.stringify(body) });
  if (res.status === 409 || res.status === 422)
    throw new StoreError("This record was changed elsewhere. Reload to see the latest version; your edits are still on screen.", 409, "conflict");
  if (!res.ok) throw new StoreError(`GitHub returned ${res.status} while saving`, 502);
  return ((await res.json()) as { content: { sha: string } }).content.sha;
}

export async function listFiles(prefix: string): Promise<string[]> {
  const { owner, repo, branch } = cfg();
  const res = await gh(`/repos/${owner}/${repo}/git/trees/${encodeURIComponent(branch)}?recursive=1`);
  if (res.status === 404 || res.status === 409) return []; // empty repo / no commits yet
  if (!res.ok) throw new StoreError(`GitHub returned ${res.status} while listing`, 502);
  const j = (await res.json()) as { tree: { path: string; type: string }[]; truncated: boolean };
  if (j.truncated) throw new StoreError("Repository listing was truncated by GitHub; refusing to continue with partial data", 502, "truncated");
  return j.tree.filter((t) => t.type === "blob" && t.path.startsWith(prefix)).map((t) => t.path).sort();
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
