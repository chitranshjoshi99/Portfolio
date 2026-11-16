// Bob's telemetry (github.com/chitranshjoshi99/Builder, packages/host/src/telemetry.ts there): a Mac whose owner turned it on
// posts once a day, and at once after a crash, {key, version, os, arch, counts…, events}. Counts only: never records, names,
// emails or app names. The key is that Mac's own ("<name>.<HMAC(BOB_SECRET, "key:<name>")>", from bob-link), so only Macs
// that joined can ping, and each ping says which one.
// Kept in Upstash Redis when it's connected to this Vercel project (KV_REST_API_URL, KV_REST_API_TOKEN): bob:macs is each
// Mac's latest ping by name, bob:pings:<name> its last 400, bob:events the last 2000 events of every Mac. Without it, pings
// go to the function's log only.
// Env: BOB_SECRET, BOB_REVOKED, KV_REST_API_URL, KV_REST_API_TOKEN.
// Self-contained on purpose, like the other bob-* functions: Vercel's bundler doesn't reliably take a shared relative import.
export const config = { runtime: "edge" };

const reply = (status: number, error?: string) =>
  new Response(JSON.stringify(error ? { error } : { ok: true }), { status, headers: { "content-type": "application/json" } });

const same = (a: string, b: string) => {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
};

const sign = async (secret: string, text: string) => {
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const s = new Uint8Array(await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(text)));
  return [...s].map((b) => b.toString(16).padStart(2, "0")).join("");
};

export default async function handler(req: Request) {
  if (req.method !== "POST") return reply(405, "post_only");
  const secret = process.env.BOB_SECRET?.trim();
  if (!secret) return reply(503, "not_set_up");
  const text = await req.text();
  if (text.length > 64_000) return reply(413, "too_big");
  let b: { [k: string]: unknown };
  try { b = JSON.parse(text); } catch { return reply(400, "bad_json"); }

  const [, name, mac] = (typeof b.key === "string" && b.key.match(/^([a-z0-9-]{1,40})\.([0-9a-f]{64})$/)) || [];
  if (!name || !same(mac, await sign(secret, `key:${name}`))) return reply(401, "bad_key");
  if ((process.env.BOB_REVOKED ?? "").split(",").map((s) => s.trim()).includes(name)) return reply(403, "revoked");

  const { key: _, events, ...counts } = b;
  const at = new Date().toISOString();
  const ping = JSON.stringify({ name, at, ...counts, events: Array.isArray(events) ? events.length : 0 });
  const evs = (Array.isArray(events) ? events.slice(0, 100) : []).map((e) => JSON.stringify({ name, ...(e as object) }));

  const url = process.env.KV_REST_API_URL, token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) {
    console.log("bob-ping", ping, evs.join("\n"));
    return reply(200);
  }
  const r = await fetch(`${url}/pipeline`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify([
      ["HSET", "bob:macs", name, ping],
      ["LPUSH", `bob:pings:${name}`, ping],
      ["LTRIM", `bob:pings:${name}`, "0", "399"],
      ...(evs.length ? [["LPUSH", "bob:events", ...evs], ["LTRIM", "bob:events", "0", "1999"]] : []),
    ]),
  }).catch(() => null);
  return r?.ok ? reply(200) : reply(502, "store_failed");
}
