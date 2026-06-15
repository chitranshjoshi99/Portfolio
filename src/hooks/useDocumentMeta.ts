import { useEffect } from "react";

interface Meta {
  title: string;
  description: string;
  url: string;
  image: string;
}

/**
 * Mirror per-route meta into the document head for users + JS-capable crawlers
 * (Google renders the SPA). Non-JS crawlers like LinkedIn never run this — they
 * get the same tags from the Vercel meta-injection function (see api/page.js).
 */
export function useDocumentMeta(m: Meta | null) {
  useEffect(() => {
    if (!m) return;
    const prevTitle = document.title;
    document.title = `${m.title} — Chitransh Joshi`;

    const set = (sel: string, attr: string, val: string) =>
      document.querySelector(sel)?.setAttribute(attr, val);

    set('meta[name="description"]', "content", m.description);
    set('link[rel="canonical"]', "href", m.url);
    set('meta[property="og:type"]', "content", "article");
    set('meta[property="og:title"]', "content", m.title);
    set('meta[property="og:description"]', "content", m.description);
    set('meta[property="og:url"]', "content", m.url);
    set('meta[property="og:image"]', "content", m.image);
    set('meta[name="twitter:card"]', "content", "summary_large_image");
    set('meta[name="twitter:title"]', "content", m.title);
    set('meta[name="twitter:description"]', "content", m.description);
    set('meta[name="twitter:image"]', "content", m.image);

    return () => {
      document.title = prevTitle;
    };
  }, [m]);
}
