// Request access, from Bob's landing page (chitransh.dev/apps/bob). It posts {name, email, note, website}; this emails the request
// to Bob's owner through Resend, with Reply-To set to the person asking, so answering is replying. The invite itself is still
// `bun run invite <email>` in github.com/chitranshjoshi99/Builder. `website` is a field people never see: only bots fill it.
// Env: RESEND_API_KEY, BOB_ACCESS_TO (where requests go), BOB_MAIL_FROM (e.g. "Bob <bob@chitransh.dev>").
export const config = { runtime: "edge" };

const EMAIL = /^[^\s@]{1,64}@[^\s@]+\.[^\s@]{2,}$/;
const reply = (status: number, error?: string) =>
  new Response(JSON.stringify(error ? { error } : { ok: true }), { status, headers: { "content-type": "application/json" } });

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

/** Text as typed, without control characters (newlines too when `line`), at most `max` long. */
const text = (v: unknown, max: number, line = false) =>
  typeof v === "string" ? v.replace(line ? /[\u0000-\u001f\u007f]/g : /[\u0000-\u0008\u000b-\u001f\u007f]/g, "").trim().slice(0, max) : "";

export default async function handler(req: Request) {
  if (req.method !== "POST") return reply(405, "post_only");
  const key = process.env.RESEND_API_KEY, to = process.env.BOB_ACCESS_TO?.trim();
  if (!key || !to) return reply(503, "not_set_up");

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return reply(400, "bad_json"); }
  if (text(body?.website, 200)) return reply(200); // a bot: tell it all went well
  const name = text(body.name, 80, true), email = text(body.email, 254, true), note = text(body.note, 1000);
  if (!name || !EMAIL.test(email)) return reply(400, "bad_input");

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";
  if (limited(`ip:${ip}`, 5, 60 * 60_000) || limited(`email:${email.toLowerCase()}`, 2, 24 * 60 * 60_000)) return reply(429, "slow_down");

  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({
      from: process.env.BOB_MAIL_FROM ?? "Bob <bob@chitransh.dev>",
      to: [to],
      reply_to: email,
      subject: `Bob access: ${name}`,
      text: `${name} <${email}> asked for Bob.\n\nWhat they'd build:\n${note || "(nothing said)"}\n\nTo invite them: bun run invite ${email}`,
    }),
  }).catch(() => null);
  return r?.ok ? reply(200) : reply(502, "send_failed");
}
