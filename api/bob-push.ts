// Bob for Android's notifications (github.com/chitranshjoshi99/Builder). A Bob posts {token, body}: a phone's Firebase token
// and the note, already encrypted for that phone (RFC 8291, the same as Web Push), so this sees only ciphertext. This sends it
// as a data-only, high-priority Firebase message. The Firebase key lives only here. Bob sends its own key (see bob-mail).
// 410 back means Firebase let go of that token: Bob stops sending there.
// Env: BOB_FCM_SA (the Firebase service account's JSON), BOB_SECRET, BOB_REVOKED.
export const config = { runtime: "edge" };

const reply = (status: number, error?: string) =>
  new Response(JSON.stringify(error ? { error } : { ok: true }), { status, headers: { "content-type": "application/json" } });

// ponytail: per instance, so only a speed bump, as in bob-mail.
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

type Account = { project_id: string; client_email: string; private_key: string };
const b64u = (b: Uint8Array | string) =>
  btoa(typeof b === "string" ? b : String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

// Google's access token for the service account, kept until a minute before it runs out.
let access: { token: string; exp: number } | null = null;
async function accessToken(sa: Account) {
  if (access && access.exp > Date.now() + 60_000) return access.token;
  const now = Math.floor(Date.now() / 1000);
  const unsigned = `${b64u(JSON.stringify({ alg: "RS256", typ: "JWT" }))}.${b64u(JSON.stringify({
    iss: sa.client_email, scope: "https://www.googleapis.com/auth/firebase.messaging", aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600,
  }))}`;
  const der = Uint8Array.from(atob(sa.private_key.replace(/-----[^-]+-----|\s/g, "")), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey("pkcs8", der, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const jwt = `${unsigned}.${b64u(new Uint8Array(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsigned))))}`;
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: jwt }),
  });
  const j = (await r.json()) as { access_token?: string; expires_in?: number };
  if (!j.access_token) throw new Error("no access token");
  access = { token: j.access_token, exp: Date.now() + (j.expires_in ?? 3600) * 1000 };
  return access.token;
}

export default async function handler(req: Request) {
  if (req.method !== "POST") return reply(405, "post_only");
  const secret = process.env.BOB_SECRET?.trim();
  let sa: Account;
  try { sa = JSON.parse(process.env.BOB_FCM_SA ?? ""); } catch { return reply(503, "not_set_up"); }
  if (!secret || !sa?.project_id) return reply(503, "not_set_up");
  const mac = await macOf(req, secret);
  if (!mac) return reply(401, "bad_token");

  let token: unknown, body: unknown;
  try { ({ token, body } = await req.json()); } catch { return reply(400, "bad_json"); }
  // 4 KB is Firebase's limit for what a message carries.
  if (typeof token !== "string" || !/^[\w:-]{20,512}$/.test(token) || typeof body !== "string" || !/^[A-Za-z0-9+/]+=*$/.test(body) || body.length > 3800)
    return reply(400, "bad_input");
  if (limited(`mac:${mac}`, 600, 60 * 60_000)) return reply(429, "slow_down");

  try {
    const r = await fetch(`https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`, {
      method: "POST",
      headers: { authorization: `Bearer ${await accessToken(sa)}`, "content-type": "application/json" },
      body: JSON.stringify({ message: { token, data: { b: body }, android: { priority: "high", ttl: "86400s" } } }),
    });
    if (r.ok) return reply(200);
    // The phone uninstalled Bob or its token was replaced: Bob drops it.
    const e = (await r.json().catch(() => ({}))) as { error?: { status?: string; details?: { errorCode?: string }[] } };
    if (r.status === 404 || e.error?.details?.some((d) => d.errorCode === "UNREGISTERED")) return reply(410, "gone");
    return reply(502, "send_failed");
  } catch {
    return reply(502, "send_failed");
  }
}
