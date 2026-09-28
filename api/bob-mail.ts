// Bob's sign-in emails (github.com/chitranshjoshi99/Builder). A Bob posts {to, code}; this sends one fixed email with that
// 6-digit code through Resend. The Resend key lives only here. Bob sends its own key (from bob-link, for its invite):
// "<name>.<HMAC(BOB_SECRET, "key:<name>")>", so each Mac has its own limit and can be cut off alone (BOB_REVOKED).
// Env: RESEND_API_KEY, BOB_SECRET, BOB_REVOKED, BOB_MAIL_FROM (e.g. "Bob <bob@chitransh.dev>", a domain verified in Resend).
export const config = { runtime: "edge" };

const EMAIL = /^[^\s@]{1,64}@[^\s@]+\.[^\s@]{2,}$/;
const reply = (status: number, error?: string) =>
  new Response(JSON.stringify(error ? { error } : { ok: true }), { status, headers: { "content-type": "application/json" } });

// ponytail: per instance, so only a speed bump; Resend's daily cap is the backstop. A Vercel WAF rate-limit rule on
// /api/bob-mail if someone ever leans on it.
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

/** The Mac's name, if the Authorization header holds its key and it isn't cut off. */
const macOf = async (req: Request, secret: string) => {
  const [, name, mac] = req.headers.get("authorization")?.match(/^Bearer ([a-z0-9-]{1,40})\.([0-9a-f]{64})$/) ?? [];
  if (!name || !same(mac, await sign(secret, `key:${name}`))) return null;
  return (process.env.BOB_REVOKED ?? "").split(",").map((s) => s.trim()).includes(name) ? null : name;
};

export default async function handler(req: Request) {
  if (req.method !== "POST") return reply(405, "post_only");
  const secret = process.env.BOB_SECRET?.trim(), key = process.env.RESEND_API_KEY;
  if (!secret || !key) return reply(503, "not_set_up");
  const mac = await macOf(req, secret);
  if (!mac) return reply(401, "bad_token");

  let to: unknown, code: unknown;
  try { ({ to, code } = await req.json()); } catch { return reply(400, "bad_json"); }
  if (typeof to !== "string" || to.length > 254 || !EMAIL.test(to) || typeof code !== "string" || !/^\d{6}$/.test(code))
    return reply(400, "bad_input");

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";
  if (limited(`to:${to.toLowerCase()}`, 3, 15 * 60_000) || limited(`ip:${ip}`, 30, 60 * 60_000) || limited(`mac:${mac}`, 20, 60 * 60_000))
    return reply(429, "slow_down");

  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({
      from: process.env.BOB_MAIL_FROM ?? "Bob <bob@chitransh.dev>",
      to: [to],
      subject: `${code} is your Bob code`,
      text: `Your code to sign in to Bob is ${code}\n\nIt works for 10 minutes. If you didn't ask for it, ignore this email: nobody gets in without the code.`,
    }),
  }).catch(() => null);
  return r?.ok ? reply(200) : reply(502, "send_failed");
}
