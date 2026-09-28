// Bob's public links (github.com/chitranshjoshi99/Builder). A Bob posts {name, port}; this makes it a Cloudflare Tunnel
// served at https://bob-<name>.chitransh.dev → 127.0.0.1:<port> on that Mac, and hands back the tunnel's token, which Bob
// keeps and runs cloudflared with. The Cloudflare key lives only here. Bob sends BOB_MAIL_TOKEN (the same one as bob-mail).
// Only bob-* names, only new ones (a name already made is someone's link: 409), and at most MAX in all, so a token pulled
// out of a Bob build can't take over an existing link or the rest of the domain. Delete a link at Cloudflare: Zero Trust →
// Networks → Tunnels, plus its DNS record.
// Env: CF_API_TOKEN (Account › Cloudflare Tunnel › Edit, Zone › DNS › Edit on chitransh.dev), CF_ACCOUNT_ID, CF_ZONE_ID,
// BOB_MAIL_TOKEN.
export const config = { runtime: "edge" };

const DOMAIN = "chitransh.dev";
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

export default async function handler(req: Request) {
  if (req.method !== "POST") return reply(405, { error: "post_only" });
  const { CF_API_TOKEN: key, CF_ACCOUNT_ID: account, CF_ZONE_ID: zone, BOB_MAIL_TOKEN: token } = process.env;
  if (!key || !account || !zone || !token) return reply(503, { error: "not_set_up" });
  if (!same(req.headers.get("authorization") ?? "", `Bearer ${token}`)) return reply(401, { error: "bad_token" });

  let name: unknown, port: unknown;
  try { ({ name, port } = await req.json()); } catch { return reply(400, { error: "bad_json" }); }
  if (typeof name !== "string" || !/^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/.test(name) || !Number.isInteger(port) || (port as number) < 1 || (port as number) > 65535)
    return reply(400, { error: "bad_input" });
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";
  if (limited(`ip:${ip}`, 5, 60 * 60_000) || limited("all", 20, 24 * 60 * 60_000)) return reply(429, { error: "slow_down" });

  const tunnel = `bob-${name}`, host = `${tunnel}.${DOMAIN}`;
  const cf = async (method: string, path: string, body?: object) => {
    const r = await fetch(`https://api.cloudflare.com/client/v4${path}`, {
      method,
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: body && JSON.stringify(body),
    });
    const j = (await r.json().catch(() => ({}))) as { success?: boolean; result?: any };
    if (!j.success) throw new Error(`${method} ${path}: ${r.status}`);
    return j.result;
  };

  try {
    const all = (await cf("GET", `/accounts/${account}/cfd_tunnel?is_deleted=false&per_page=1000`)) as { name: string }[];
    if (all.some((t) => t.name === tunnel)) return reply(409, { error: "taken" });
    if (all.filter((t) => t.name.startsWith("bob-")).length >= MAX) return reply(429, { error: "full" });
    const made = await cf("POST", `/accounts/${account}/cfd_tunnel`, { name: tunnel, config_src: "cloudflare" });
    await cf("PUT", `/accounts/${account}/cfd_tunnel/${made.id}/configurations`, {
      config: {
        ingress: [
          { hostname: host, service: `http://127.0.0.1:${port}`, originRequest: { httpHostHeader: host } },
          { service: "http_status:404" },
        ],
      },
    });
    await cf("POST", `/zones/${zone}/dns_records`, { type: "CNAME", name: host, content: `${made.id}.cfargotunnel.com`, proxied: true });
    const tok = made.token ?? (await cf("GET", `/accounts/${account}/cfd_tunnel/${made.id}/token`));
    return reply(200, { url: `https://${host}`, token: tok });
  } catch (e) {
    console.error(e);
    return reply(502, { error: "cloudflare_failed" });
  }
}
