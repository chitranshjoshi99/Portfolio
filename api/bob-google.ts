// Bob's Google sign-in (github.com/chitranshjoshi99/Builder). Google sends the phone to chitransh.dev/bob with a code, which takes
// it back to its Bob; that Bob posts {code, verifier} (its PKCE verifier) here with its own key (see bob-mail), and gets Google's
// answer ({id_token}) back as is. The client secret lives only here, so no Bob build carries it.
// Env: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, BOB_SECRET, BOB_REVOKED.
export const config = { runtime: "edge" };

const RELAY = "https://chitransh.dev/bob"; // the redirect_uri Bob asked Google for
const reply = (status: number, body: object) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

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
  if (req.method !== "POST") return reply(405, { error: "post_only" });
  const id = process.env.GOOGLE_CLIENT_ID?.trim(), clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  const secret = process.env.BOB_SECRET?.trim();
  if (!id || !clientSecret || !secret) return reply(503, { error: "not_set_up" });
  if (!(await macOf(req, secret))) return reply(401, { error: "bad_token" });

  let code: unknown, verifier: unknown;
  try { ({ code, verifier } = await req.json()); } catch { return reply(400, { error: "bad_json" }); }
  if (typeof code !== "string" || code.length > 2048 || typeof verifier !== "string" || !/^[\w-]{43,128}$/.test(verifier))
    return reply(400, { error: "bad_input" });

  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    body: new URLSearchParams({ code, client_id: id, client_secret: clientSecret, redirect_uri: RELAY, grant_type: "authorization_code", code_verifier: verifier }),
  }).catch(() => null);
  const j = r ? ((await r.json().catch(() => ({}))) as { id_token?: unknown }) : {};
  return typeof j.id_token === "string" ? reply(200, { id_token: j.id_token }) : reply(502, { error: "google_failed" });
}
