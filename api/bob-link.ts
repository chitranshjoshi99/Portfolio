// Bob's public links (github.com/chitranshjoshi99/Builder). A Bob posts {name}; this points https://bob-<name>.chitransh.dev
// at bob-relay (Bob's own server in Mumbai, packages/relay there) and hands back the relay's address and the address's
// signature, HMAC-SHA256(RELAY_SECRET, address), which Bob keeps and gives the relay to prove the address is its own.
// The DNS records are the list of names: only bob-* names, only new ones (a name with a record is someone's link: 409), and
// at most MAX in all, so a token pulled out of a Bob build can't take over an existing link or the rest of the domain.
// Delete a link: its DNS record at Cloudflare. Bob sends BOB_MAIL_TOKEN (the same one as bob-mail).
// Env: CF_API_TOKEN (Zone › DNS › Edit on chitransh.dev), CF_ZONE_ID, RELAY_IP (the relay server's public IP),
// RELAY_SECRET (the same as the relay's), BOB_MAIL_TOKEN.
export const config = { runtime: "edge" };

const DOMAIN = "chitransh.dev";
const RELAY = `relay.${DOMAIN}:7000`;
const MAX = 50;
const reply = (status: number, body: object) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

// ponytail: per instance, so only a speed bump; MAX is the backstop.
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
  const { CF_API_TOKEN: key, CF_ZONE_ID: zone, RELAY_IP: ip4, BOB_MAIL_TOKEN: token } = process.env;
  const secret = process.env.RELAY_SECRET?.trim(); // pasted values can bring a newline
  if (!key || !zone || !ip4 || !secret || !token) return reply(503, { error: "not_set_up" });
  if (!same(req.headers.get("authorization") ?? "", `Bearer ${token}`)) return reply(401, { error: "bad_token" });

  let name: unknown;
  try { ({ name } = await req.json()); } catch { return reply(400, { error: "bad_json" }); }
  if (typeof name !== "string" || !/^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/.test(name)) return reply(400, { error: "bad_input" });
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";
  if (limited(`ip:${ip}`, 5, 60 * 60_000) || limited("all", 20, 24 * 60 * 60_000)) return reply(429, { error: "slow_down" });

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
    if (names.includes(host)) return reply(409, { error: "taken" });
    if (new Set(names.filter((n) => n.startsWith("bob-"))).size >= MAX) return reply(429, { error: "full" });
    await cf("POST", "/dns_records", { type: "A", name: host, content: ip4, proxied: false, ttl: 300 });
    return reply(200, { url: `https://${host}`, relay: RELAY, sig: await sign(secret, host) });
  } catch (e) {
    console.error(e);
    return reply(502, { error: "cloudflare_failed" });
  }
}
