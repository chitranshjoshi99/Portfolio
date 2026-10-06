// Google sign-in relay for Bob, the Mac app server (redirect URI https://chitransh.dev/bob). Google only redirects to one fixed https address,
// but every Bob lives at its own: https://bob-<user>.chitransh.dev (before: <tailnet>.ts.net), or a Wi-Fi address. Bob puts its address in
// `state` (base64url JSON {o, s}); this page sends the phone back to <o>/_auth/cb with Google's answer untouched.
// The code is useless without the PKCE verifier and client secret that only that Bob holds.
// Runs in <head>: with no sign-in answer in the address, it does nothing and Bob's landing page shows; with one, html.relay hides
// the page so it never flashes on the way back.
(() => {
  const q = new URLSearchParams(location.search);
  if (!q.has("state") && !q.has("code") && !q.has("error")) return;
  document.documentElement.classList.add("relay");
  // ponytail: any tailnet's bob-* host; pin the tailnet name here once it's fixed
  const ALLOWED = [
    /^https:\/\/bob-[a-z0-9-]+\.chitransh\.dev$/, // the public link, a Cloudflare Tunnel (api/bob-link.ts)
    /^https:\/\/bob-[a-z0-9-]+\.[a-z0-9-]+\.ts\.net$/,
    /^http:\/\/[a-z0-9-]+\.local:\d{1,5}$/,
    /^http:\/\/(10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}):\d{1,5}$/,
    /^http:\/\/(localhost|127\.0\.0\.1):\d{1,5}$/,
  ];
  let o = "";
  try {
    const s = q.get("state") || "";
    o = JSON.parse(atob(s.replace(/-/g, "+").replace(/_/g, "/"))).o;
  } catch {}
  if (typeof o === "string" && ALLOWED.some((r) => r.test(o))) location.replace(`${o}/_auth/cb${location.search}`);
  else
    document.addEventListener("DOMContentLoaded", () => {
      document.getElementById("msg").textContent = "This sign-in link isn't from a Bob. Open Bob and try again.";
    });
})();
