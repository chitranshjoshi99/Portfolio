import { ImageResponse } from "@vercel/og";

export const config = { runtime: "edge" };

// Self-contained: reads title/tag/accent from query params (built by
// api/page.js + the app via ogImageUrl in blogs.config.ts). No cross-module
// imports, so the edge bundle stays clean.

// Press Start 2P TTF — Satori needs a real font file in the edge runtime.
const FONT_URL =
  "https://raw.githubusercontent.com/google/fonts/main/ofl/pressstart2p/PressStart2P-Regular.ttf";

export default async function handler(req: Request) {
  const { searchParams } = new URL(req.url);
  const title = searchParams.get("title") ?? "Engineering notes & live POCs";
  const tag = searchParams.get("tag") ?? "LABS";
  const accent = searchParams.get("accent") ?? "#9b8ea0";

  const font = await fetch(FONT_URL).then((r) => r.arrayBuffer());

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px",
          background: "#16141a",
          color: "#e8e4dc",
          fontFamily: "PressStart2P",
          backgroundImage: "radial-gradient(#26222e 1.5px, transparent 1.5px)",
          backgroundSize: "28px 28px",
        }}
      >
        <div style={{ display: "flex", fontSize: 22, color: accent }}>{tag}</div>
        <div
          style={{
            display: "flex",
            fontSize: 34,
            lineHeight: 1.5,
            maxWidth: "960px",
          }}
        >
          {title}
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            width: "100%",
            fontSize: 18,
            color: "#9b8ea0",
          }}
        >
          <span>chitransh joshi</span>
          <span>· labs</span>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      fonts: [
        { name: "PressStart2P", data: font, style: "normal", weight: 400 },
      ],
    },
  );
}
