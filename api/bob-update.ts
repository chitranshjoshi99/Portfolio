// Bob's updates (github.com/chitranshjoshi99/Builder, a private repo): the Mac app (Services/Updater.swift there) asks this
// every 6 hours. GET → {version, notes, dmg} from the repo's latest GitHub release; GET ?dmg=<version> → a redirect to that
// release's Bob-<version>.dmg, a short-lived signed GitHub address, so the download never passes through here.
// Env: BOB_GITHUB_TOKEN (fine-grained, read-only Contents on the Builder repo and nothing else).
// Self-contained on purpose, like the other bob-* functions: Vercel's bundler doesn't reliably take a shared relative import.
export const config = { runtime: "edge" };

const REPO = "chitranshjoshi99/Builder";
const reply = (status: number, body: object, cache = "no-store") =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": cache } });

export default async function handler(req: Request) {
  if (req.method !== "GET") return reply(405, { error: "get_only" });
  const token = process.env.BOB_GITHUB_TOKEN?.trim();
  if (!token) return reply(503, { error: "not_set_up" });
  const gh = (path: string, init: RequestInit = {}) =>
    fetch(`https://api.github.com/repos/${REPO}${path}`, {
      ...init,
      headers: { authorization: `Bearer ${token}`, accept: "application/vnd.github+json", "user-agent": "bob-update", ...init.headers },
    });

  const want = new URL(req.url).searchParams.get("dmg");
  if (want !== null) {
    if (!/^\d+\.\d+\.\d+$/.test(want)) return reply(400, { error: "bad_version" });
    const rel = (await (await gh(`/releases/tags/v${want}`)).json().catch(() => null)) as { assets?: { id: number; name: string }[] } | null;
    const asset = rel?.assets?.find((a) => a.name === `Bob-${want}.dmg`);
    if (!asset) return reply(404, { error: "no_such_release" });
    const r = await gh(`/releases/assets/${asset.id}`, { headers: { accept: "application/octet-stream" }, redirect: "manual" });
    const to = r.headers.get("location");
    return to ? Response.redirect(to, 302) : reply(502, { error: "github_failed" });
  }

  const r = await gh("/releases/latest");
  const rel = (await r.json().catch(() => null)) as { tag_name?: string; body?: string } | null;
  const version = rel?.tag_name?.replace(/^v/, "");
  if (!r.ok || !version || !/^\d+\.\d+\.\d+$/.test(version)) return reply(502, { error: "github_failed" });
  const notes = (rel?.body ?? "").split("\n### Install")[0].trim().slice(0, 4000);
  const dmg = new URL(`/api/bob-update?dmg=${version}`, req.url).href;
  return reply(200, { version, notes, dmg }, "public, s-maxage=900"); // one GitHub call per 15 minutes, however many Macs ask
}
