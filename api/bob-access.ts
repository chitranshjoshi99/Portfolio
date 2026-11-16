// Request access, from Bob's landing page (chitransh.dev/apps/bob) and from Bob itself on a Mac (setup's "Email me an invite",
// through the host's /_admin/join/request). It posts {name, email, note, website}; `website` is a field people never see: only
// bots fill it.
// Self-serve (BOB_SELF_SERVE=on): the invite is made here, the same one `bun run invite <email>` makes in
// github.com/chitranshjoshi99/Builder ("<name>.<made at, hex>.<HMAC(BOB_SECRET, "invite:<name>:<email>:<made at>")>", checked by
// bob-link), and emailed to that address, which is how we know it's theirs. Its name is the start of their email, with -2,
// -3… when someone else holds that address already (the note on each bob-* DNS record says who: see bob-link). The owner gets
// a line about it. Off, or when every address is taken (bob-link's MAX), the request is emailed to the owner as before, with
// Reply-To the person asking, so answering is replying. Answers {ok, invite: "sent" | "requested"}.
// Env: RESEND_API_KEY, BOB_ACCESS_TO (the owner), BOB_MAIL_FROM, and for self-serve BOB_SELF_SERVE, BOB_SECRET, CF_API_TOKEN, CF_ZONE_ID.
// Self-contained on purpose, like the other bob-* functions: Vercel's bundler doesn't reliably take a shared relative import.
export const config = { runtime: "edge" };

const EMAIL = /^[^\s@]{1,64}@[^\s@]+\.[^\s@]{2,}$/;
const MAX = 50; // bob-link's: how many bob-* addresses there may be
const reply = (status: number, body: object) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const fail = (status: number, error: string) => reply(status, { error });

// ponytail: per instance, so only a speed bump, as in bob-mail.ts. A Vercel WAF rate-limit rule on /api/bob-access if someone leans on it.
const seen = new Map<string, number[]>();
const limited = (key: string, max: number, ms: number) => {
  const t = Date.now();
  const recent = (seen.get(key) ?? []).filter((x) => t - x < ms);
  if (recent.length >= max) return true;
  recent.push(t);
  seen.set(key, recent);
  return false;
};

const sign = async (secret: string, text: string) => {
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const s = new Uint8Array(await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(text)));
  return [...s].map((b) => b.toString(16).padStart(2, "0")).join("");
};

/** Text as typed, without control characters (newlines too when `line`), at most `max` long. */
const text = (v: unknown, max: number, line = false) =>
  typeof v === "string" ? v.replace(line ? /[\u0000-\u001f\u007f]/g : /[\u0000-\u0008\u000b-\u001f\u007f]/g, "").trim().slice(0, max) : "";

const mail = (key: string, msg: object) =>
  fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({ from: process.env.BOB_MAIL_FROM ?? "Bob <bob@chitransh.dev>", ...msg }),
  }).then((r) => r.ok, () => false);

/** An invite for `email` on a free address, or null when self-serve is off or there's no room. */
async function invite(email: string): Promise<{ code: string; host: string } | null> {
  const secret = process.env.BOB_SECRET?.trim(), { CF_API_TOKEN: cf, CF_ZONE_ID: zone } = process.env;
  if (process.env.BOB_SELF_SERVE !== "on" || !secret || !cf || !zone) return null;
  const r = await fetch(`https://api.cloudflare.com/client/v4/zones/${zone}/dns_records?per_page=5000`, {
    headers: { authorization: `Bearer ${cf}` },
  }).catch(() => null);
  const records = ((await r?.json().catch(() => null)) as { result?: { name: string; comment?: string | null }[] } | null)?.result;
  if (!records) return null;
  const holder = new Map(records.filter((x) => x.name.startsWith("bob-")).map((x) => [x.name, x.comment?.match(/^bob ([0-9a-f]{16}) /)?.[1] ?? ""]));
  const person = (await sign(secret, `email:${email}`)).slice(0, 16);
  const base = email.split("@")[0].replace(/[^a-z0-9]+/g, "-").slice(0, 30).replace(/^-+|-+$/g, "") || "mac";
  for (const name of [base, ...Array.from({ length: 19 }, (_, i) => `${base}-${i + 2}`)]) {
    const host = `bob-${name}.chitransh.dev`;
    const theirs = holder.get(host);
    if (theirs === undefined && holder.size >= MAX) return null; // a new address, and there's no room for one
    if (theirs !== undefined && theirs !== person) continue; // someone else's (or from before invites: its first invite takes it)
    const made = Math.floor(Date.now() / 1000).toString(16).padStart(8, "0");
    return { code: `${name}.${made}.${(await sign(secret, `invite:${name}:${email}:${made}`)).slice(0, 24)}`, host };
  }
  return null;
}

export default async function handler(req: Request) {
  if (req.method !== "POST") return fail(405, "post_only");
  const key = process.env.RESEND_API_KEY, owner = process.env.BOB_ACCESS_TO?.trim();
  if (!key || !owner) return fail(503, "not_set_up");

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return fail(400, "bad_json"); }
  if (text(body?.website, 200)) return reply(200, { ok: true, invite: "requested" }); // a bot: tell it all went well
  const email = text(body.email, 254, true).toLowerCase(), name = text(body.name, 80, true) || email.split("@")[0], note = text(body.note, 1000);
  if (!EMAIL.test(email)) return fail(400, "bad_input");

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";
  if (limited(`ip:${ip}`, 5, 60 * 60_000) || limited(`email:${email}`, 2, 24 * 60 * 60_000)) return fail(429, "slow_down");

  const inv = await invite(email);
  if (inv) {
    const sent = await mail(key, {
      to: [email],
      reply_to: owner,
      subject: "Your invite to Bob",
      text:
        `Here's your invite to Bob, which turns your Mac into the server for your own small apps.\n\n` +
        `Open Bob on your Mac. When it asks, type this email (${email}) and this code:\n\n    ${inv.code}\n\n` +
        `It gets you your own link, https://${inv.host}. The code works once, and only with this email.\n\n` +
        `Don't have Bob yet? Get it at https://chitransh.dev/apps/bob. Questions? Reply to this email.`,
    });
    if (!sent) return fail(502, "send_failed");
    await mail(key, { to: [owner], reply_to: email, subject: `Bob: ${name} joined`, text: `${name} <${email}> got an invite for https://${inv.host}.\n\nWhat they'd build:\n${note || "(nothing said)"}` });
    return reply(200, { ok: true, invite: "sent" });
  }

  const sent = await mail(key, {
    to: [owner],
    reply_to: email,
    subject: `Bob access: ${name}`,
    text: `${name} <${email}> asked for Bob.\n\nWhat they'd build:\n${note || "(nothing said)"}\n\nTo invite them: bun run invite ${email}`,
  });
  return sent ? reply(200, { ok: true, invite: "requested" }) : fail(502, "send_failed");
}
