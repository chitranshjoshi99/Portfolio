export const config = { runtime: "edge" };

const decode = (s: string) =>
  s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/gi, "'");

// Grab an og:/twitter:/name meta value regardless of attribute order.
// Lazy quantifiers + head-only input keep this cheap inside the Edge CPU budget.
const meta = (html: string, prop: string): string => {
  const res = [
    new RegExp(
      `<meta[^>]*?(?:property|name)=["']${prop}["'][^>]*?content=["']([^"']*)`,
      "i",
    ),
    new RegExp(
      `<meta[^>]*?content=["']([^"']*)["'][^>]*?(?:property|name)=["']${prop}["']`,
      "i",
    ),
  ];
  for (const re of res) {
    const m = html.match(re);
    if (m) return decode(m[1].trim());
  }
  return "";
};

export default async function handler(req: Request) {
  const cors = {
    "access-control-allow-origin": "*",
    "content-type": "application/json",
  };

  try {
    const target = new URL(req.url).searchParams.get("url") || "";

    let parsed: URL;
    try {
      parsed = new URL(target);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        throw new Error("bad protocol");
      }
    } catch {
      return new Response(
        JSON.stringify({ error: "Enter a valid http(s) URL" }),
        {
          status: 400,
          headers: cors,
        },
      );
    }

    const r = await fetch(parsed.toString(), {
      headers: {
        "user-agent":
          "Mozilla/5.0 (compatible; LinkPreviewBot/1.0; +https://chitransh.dev)",
        accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
    });

    if (!r.ok) {
      return new Response(
        JSON.stringify({ error: `Couldn't fetch that page (${r.status})` }),
        { status: 502, headers: cors },
      );
    }

    // OG/Twitter/title tags all live in <head>; scanning only the head keeps the
    // regex work tiny and well inside the Edge runtime's CPU limit.
    const full = await r.text();
    const headEnd = full.search(/<\/head>/i);
    const html = (headEnd > -1 ? full.slice(0, headEnd) : full).slice(
      0,
      120_000,
    );

    const titleTag = html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] ?? "";
    let image = meta(html, "og:image") || meta(html, "twitter:image");
    if (image.startsWith("/")) image = parsed.origin + image;

    return new Response(
      JSON.stringify({
        title:
          meta(html, "og:title") || decode(titleTag.trim()) || parsed.hostname,
        description: meta(html, "og:description") || meta(html, "description"),
        image,
        url: parsed.toString(),
        site: parsed.hostname.replace(/^www\./, ""),
      }),
      { headers: { ...cors, "cache-control": "public, s-maxage=600" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({
        error: "Couldn't fetch that page",
        detail: String((err as Error)?.message || err),
      }),
      { status: 502, headers: cors },
    );
  }
}
