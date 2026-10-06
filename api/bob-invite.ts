// Bob's invite emails (github.com/chitranshjoshi99/Builder). `bun run invite <email>` there posts {email, invite}; this checks the
// invite the same way bob-link does (HMAC(BOB_SECRET, "invite:<name>:<email>:<nonce>")) and emails it to that address through
// Resend. No new secret: a good invite can only ever be sent to the email it was made for, so whoever holds one can at most
// send it again to its owner. Replies go to BOB_ACCESS_TO (the owner).
// Env: RESEND_API_KEY, BOB_SECRET, BOB_ACCESS_TO, BOB_MAIL_FROM.
// Self-contained on purpose, like the other bob-* functions: Vercel's bundler doesn't reliably take a shared relative import.
export const config = { runtime: "edge" };

const reply = (status: number, error?: string) =>
  new Response(JSON.stringify(error ? { error } : { ok: true }), { status, headers: { "content-type": "application/json" } });

// ponytail: per instance, so only a speed bump; an invite only ever goes to its own email.
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
  if (req.method !== "POST") return reply(405, "post_only");
  const secret = process.env.BOB_SECRET?.trim(), key = process.env.RESEND_API_KEY, owner = process.env.BOB_ACCESS_TO?.trim();
  if (!secret || !key) return reply(503, "not_set_up");

  let invite: unknown, email: unknown;
  try { ({ invite, email } = await req.json()); } catch { return reply(400, "bad_json"); }
  const [, name, nonce, mac] = (typeof invite === "string" && invite.match(/^([a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?)\.([0-9a-f]{8})\.([0-9a-f]{24})$/)) || [];
  const to = typeof email === "string" && email.length <= 254 ? email.trim().toLowerCase() : "";
  if (!name || !to || !same(mac, (await sign(secret, `invite:${name}:${to}:${nonce}`)).slice(0, 24))) return reply(401, "bad_invite");

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";
  if (limited(`to:${to}`, 3, 24 * 60 * 60_000) || limited(`ip:${ip}`, 10, 60 * 60_000)) return reply(429, "slow_down");

  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({
      from: process.env.BOB_MAIL_FROM ?? "Bob <bob@chitransh.dev>",
      to: [to],
      ...(owner && { reply_to: owner }),
      subject: "Your invite to Bob",
      text:
        `You're invited to Bob, which turns your Mac into the server for your own small apps.\n\n` +
        `Open Bob on your Mac. When it asks, type this email (${to}) and this code:\n\n    ${invite}\n\n` +
        `The code works once, and only with this email. Questions? Reply to this email.\n\nhttps://chitransh.dev/apps/bob`,
    }),
  }).catch(() => null);
  return r?.ok ? reply(200) : reply(502, "send_failed");
}
