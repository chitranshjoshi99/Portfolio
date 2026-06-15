import { ImageResponse } from "@vercel/og";
import { BLOGS } from "../blogs.config";

export const config = { runtime: "edge" };

// Press Start 2P TTF (Satori needs a real font file in the edge runtime)
const FONT_URL =
  "https://raw.githubusercontent.com/google/fonts/main/ofl/pressstart2p/PressStart2P-Regular.ttf";

export default async function handler(req: Request) {
  const { searchParams } = new URL(req.url);
  const slug = searchParams.get("slug") ?? "";
  const blog = BLOGS.find((b) => b.slug === slug) ?? {
    title: "Engineering notes & live POCs",
    tag: "LABS",
    accent: "#9b8ea0",
  };

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
        <div style={{ display: "flex", fontSize: 22, color: blog.accent }}>
          {blog.tag}
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 34,
            lineHeight: 1.5,
            maxWidth: "960px",
          }}
        >
          {blog.title}
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
