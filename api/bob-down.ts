// "Your Mac is offline" emails for Bob (github.com/chitranshjoshi99/Builder). bob-relay (packages/relay/plugin.py there) posts
// {host, email, at, sig} when a Mac has been gone from its address for 10 minutes; sig = HMAC(RELAY_SECRET,
// "down:<host>:<email>:<at>"), so only the relay can ask. The email came from the Mac, so it must be the one holding the
// address: the note on its DNS record names the holder as HMAC(BOB_SECRET, "email:<email>") (see bob-link). Then one plain
// email to the owner through Resend. The relay sends at most one per address every 6 hours.
// Env: RELAY_SECRET, BOB_SECRET, CF_API_TOKEN, CF_ZONE_ID, RESEND_API_KEY, BOB_ACCESS_TO (Reply-To), BOB_MAIL_FROM.
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
  const relaySecret = process.env.RELAY_SECRET?.trim(), secret = process.env.BOB_SECRET?.trim();
  const { CF_API_TOKEN: cf, CF_ZONE_ID: zone, RESEND_API_KEY: key } = process.env;
  if (!relaySecret || !secret || !cf || !zone || !key) return reply(503, "not_set_up");

  let b: { host?: unknown; email?: unknown; at?: unknown; sig?: unknown };
  try { b = await req.json(); } catch { return reply(400, "bad_json"); }
  const { host, email, at, sig } = b;
  if (typeof host !== "string" || !/^bob-[a-z0-9-]{1,40}\.chitransh\.dev$/.test(host) || typeof email !== "string" ||
      email.length > 254 || typeof at !== "string" || !/^\d{10}$/.test(at) || typeof sig !== "string") return reply(400, "bad_input");
  if (!same(sig, await sign(relaySecret, `down:${host}:${email}:${at}`))) return reply(401, "bad_sig");
  if (Math.abs(Date.now() / 1000 - Number(at)) > 600) return reply(401, "stale"); // no replaying an old one

  const r = await fetch(`https://api.cloudflare.com/client/v4/zones/${zone}/dns_records?name=${host}`, {
    headers: { authorization: `Bearer ${cf}` },
  }).catch(() => null);
  const rec = ((await r?.json().catch(() => null)) as { result?: { comment?: string | null }[] } | null)?.result?.[0];
  const holder = rec?.comment?.match(/^bob ([0-9a-f]{16}) /)?.[1];
  const who = email.trim().toLowerCase();
  if (!holder || holder !== (await sign(secret, `email:${who}`)).slice(0, 16)) return reply(403, "not_theirs");

  const sent = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({
      from: process.env.BOB_MAIL_FROM ?? "Bob <bob@chitransh.dev>",
      to: [who],
      ...(process.env.BOB_ACCESS_TO?.trim() && { reply_to: process.env.BOB_ACCESS_TO.trim() }),
      subject: "Your Bob apps are offline",
      text:
        `Your Mac stopped answering at https://${host} about 10 minutes ago, so phones can't open your apps right now.\n\n` +
        `Check that the Mac is on, plugged in, connected to the internet, and that Bob is open. Your apps come back by ` +
        `themselves once it is. Phones on the same Wi-Fi as the Mac may still reach them.\n\n` +
        `If you turned the link off on purpose, you can ignore this. Questions? Reply to this email.`,
    }),
  }).catch(() => null);
  return sent?.ok ? reply(200) : reply(502, "send_failed");
}
