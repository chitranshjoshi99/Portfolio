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
const meta = (html: string, prop: string): string => {
  const res = [
    new RegExp(
      `<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']*)["']`,
      "i",
    ),
    new RegExp(
      `<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${prop}["']`,
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

  const target = new URL(req.url).searchParams.get("url") || "";

  // Validate earlier and more explicitly
  if (!target) {
    return new Response(
      JSON.stringify({ error: "Enter a valid http(s) URL" }),
      {
        status: 400,
        headers: cors,
      },
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(target);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error("bad protocol");
    }
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Enter a valid http(s) URL" }),
      {
        status: 400,
        headers: cors,
      },
    );
  }

  try {
    const r = await fetch(parsed.toString(), {
      headers: {
        "user-agent": "LinkedInBot/1.0 (preview)",
        accept: "text/html",
      },
      redirect: "follow",
      // Add timeout to prevent hanging
      ...(Deno?.timeout ? { timeout: Deno.timeout(10000) } : {}),
    });

    // Check response status BEFORE trying to read text
    if (!r.ok) {
      return new Response(
        JSON.stringify({ error: `Couldn't fetch that page (${r.status})` }),
        {
          status: r.status,
          headers: cors,
        },
      );
    }

    const html = (await r.text()).slice(0, 250_000);

    const titleTag = html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] ?? "";
    let image = meta(html, "og:image") || meta(html, "twitter:image");

    // FIX: Handle undefined image (this is likely causing the crash)
    if (image && image.startsWith("/")) {
      image = parsed.origin + image;
    }
    image = image || "";

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
    // Log the actual error to see what's happening
    console.error("Preview fetch error:", err);

    return new Response(JSON.stringify({ error: "Couldn't fetch that page" }), {
      status: 502,
      headers: cors,
    });
  }
}
