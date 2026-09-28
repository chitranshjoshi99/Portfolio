// Bob's invites (github.com/chitranshjoshi99/Builder). A Bob posts {invite}, the code its owner pasted: "<name>.<hex>", made by
// `bun run invite <name>` there as HMAC(BOB_SECRET, "invite:<name>"). A good one gets that Mac everything it needs, and nothing
// in a Bob build is secret:
//   url    https://bob-<name>.chitransh.dev, an A record pointing at bob-relay (Bob's own server in Mumbai, packages/relay)
//   relay  the relay's address, and sig = HMAC(RELAY_SECRET, address), which the relay checks before it serves the address
//   key    "<name>.<HMAC(BOB_SECRET, "key:<name>")>", this Mac's own, for bob-mail and bob-google
//   google the Google client id (null: no Google sign-in)
// The same invite again gives the same answer, so a reinstalled Mac gets its address back. Cut a Mac off: add its name to
// BOB_REVOKED (comma-separated; bob-mail and bob-google check it too), then delete its DNS record at Cloudflare.
// Env: CF_API_TOKEN (Zone › DNS › Edit on chitransh.dev), CF_ZONE_ID, RELAY_IP (the relay's public IP), RELAY_SECRET (the same
// as the relay's), BOB_SECRET (the same as .bob-secret in Builder), GOOGLE_CLIENT_ID, BOB_REVOKED.
// Self-contained on purpose, like the other bob-* functions: Vercel's bundler doesn't reliably take a shared relative import.
export const config = { runtime: "edge" };

const DOMAIN = "chitransh.dev";
const MAX = 50;
const reply = (status: number, body: object) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

// ponytail: per instance, so only a speed bump; an invite is still needed to get anything.
const seen = new Map<string, number[]>();
const limited = (key: string, max: number, ms: number) => {
  const t = Date.now();
  const recent = (seen.get(key) ?? []).filter((x) => t - x < ms);
  if (recent.length >= max) return true;
  recent.push(t);
  seen.set(key, recent);
  return false;
};

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
  if (req.method !== "POST") return reply(405, { error: "post_only" });
  const { CF_API_TOKEN: key, CF_ZONE_ID: zone, RELAY_IP: ip4 } = process.env;
  const relaySecret = process.env.RELAY_SECRET?.trim(), secret = process.env.BOB_SECRET?.trim(); // pasted values can bring a newline
  if (!key || !zone || !ip4 || !relaySecret || !secret) return reply(503, { error: "not_set_up" });
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";
  if (limited(`ip:${ip}`, 10, 60 * 60_000)) return reply(429, { error: "slow_down" });

  let invite: unknown;
  try { ({ invite } = await req.json()); } catch { return reply(400, { error: "bad_json" }); }
  const [, name, mac] = (typeof invite === "string" && invite.match(/^([a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?)\.([0-9a-f]{32})$/)) || [];
  if (!name || !same(mac, (await sign(secret, `invite:${name}`)).slice(0, 32))) return reply(401, { error: "bad_invite" });
  if ((process.env.BOB_REVOKED ?? "").split(",").map((s) => s.trim()).includes(name)) return reply(403, { error: "revoked" });

  const host = `bob-${name}.${DOMAIN}`;
  const cf = async (method: string, path: string, body?: object) => {
    const r = await fetch(`https://api.cloudflare.com/client/v4/zones/${zone}${path}`, {
      method,
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: body && JSON.stringify(body),
    });
    const j = (await r.json().catch(() => ({}))) as { success?: boolean; result?: unknown };
    if (!j.success) throw new Error(`${method} ${path}: ${r.status}`);
    return j.result;
  };

  try {
    const names = ((await cf("GET", "/dns_records?per_page=5000")) as { name: string }[]).map((r) => r.name);
    if (!names.includes(host)) {
      if (new Set(names.filter((n) => n.startsWith("bob-"))).size >= MAX) return reply(429, { error: "full" });
      await cf("POST", "/dns_records", { type: "A", name: host, content: ip4, proxied: false, ttl: 300 });
    }
    return reply(200, {
      // The relay by IP: no DNS lookup to go stale, and Bob knows it by its pinned certificate, not its name.
      url: `https://${host}`, relay: `${ip4}:7000`, sig: await sign(relaySecret, host),
      key: `${name}.${await sign(secret, `key:${name}`)}`, google: process.env.GOOGLE_CLIENT_ID?.trim() || null,
    });
  } catch (e) {
    console.error(e);
    return reply(502, { error: "cloudflare_failed" });
  }
}
