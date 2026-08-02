import { useState } from "react";
import type { GameProps } from "../types";
import "./style.css";

type Preview = {
  title: string;
  description: string;
  image: string;
  url: string;
  site: string;
};

export function LinkPreview(_props: GameProps) {
  const [url, setUrl] = useState("");
  const [data, setData] = useState<Preview | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [err, setErr] = useState("");

  const tune = async (e: React.FormEvent) => {
    e.preventDefault();
    const u = url.trim();
    if (!u) return;
    setStatus("loading");
    setErr("");
    try {
      const res = await fetch(`/api/preview?url=${encodeURIComponent(u)}`);
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error || "Failed");
      setData(json as Preview);
      setStatus("idle");
    } catch (e2) {
      setStatus("error");
      setErr(e2 instanceof Error ? e2.message : "Couldn't load preview");
      setData(null);
    }
  };

  return (
    <div className="lp">
      <div className="lp__screen">
        {status === "loading" && (
          <p className="lp__msg pixel-text">TUNING IN...</p>
        )}
        {status === "error" && (
          <p className="lp__msg lp__msg--err pixel-text">NO SIGNAL · {err}</p>
        )}
        {status === "idle" && !data && (
          <p className="lp__msg pixel-text">
            PASTE A URL BELOW
            <br />
            TO TUNE IN
          </p>
        )}
        {status === "idle" && data && (
          <div className="lp__card">
            {data.image ? (
              <img className="lp__img" src={data.image} alt="" />
            ) : (
              <div className="lp__img lp__img--none pixel-text">NO IMAGE</div>
            )}
            <div className="lp__meta">
              <span className="lp__site pixel-text">{data.site}</span>
              <span className="lp__title">{data.title}</span>
              {data.description && (
                <span className="lp__desc">{data.description}</span>
              )}
            </div>
          </div>
        )}
      </div>

      <form className="lp__bar" onSubmit={tune}>
        <input
          className="lp__input vt-text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://chitransh.dev/labs"
          aria-label="Page URL to preview"
          inputMode="url"
          spellCheck={false}
        />
        <button className="lp__btn pixel-text" type="submit">
          TUNE
        </button>
      </form>
    </div>
  );
}
