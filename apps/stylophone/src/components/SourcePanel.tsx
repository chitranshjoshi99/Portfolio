import { useState, type FormEvent } from "react";
import { processSource, type ReductionInput } from "../lib/reduction";
import type { Lesson } from "../lib/lesson";
import "./SourcePanel.css";

type SourceType = ReductionInput["type"];

type SourcePanelProps = {
  onDraft: (lesson: Lesson) => void;
};

const RAIL_TICKS = 32;
const MAX_CLIP_SECONDS = 15;

export default function SourcePanel({ onDraft }: SourcePanelProps) {
  const [sourceType, setSourceType] = useState<SourceType>("file");
  const [file, setFile] = useState<File | null>(null);
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [clipStart, setClipStart] = useState("0");
  const [clipEnd, setClipEnd] = useState("15");
  const [bpm, setBpm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const startValue = Number(clipStart);
  const endValue = Number(clipEnd);
  const duration = endValue - startValue;
  const durationIsValid =
    Number.isFinite(duration) && duration > 0 && duration <= MAX_CLIP_SECONDS;
  const activeTicks = durationIsValid
    ? Math.max(1, Math.round((duration / MAX_CLIP_SECONDS) * RAIL_TICKS))
    : 0;
  const clipReadout =
    Number.isFinite(startValue) && Number.isFinite(endValue)
      ? `${startValue}s — ${endValue}s · ${durationIsValid ? duration : "—"}s selected`
      : "Set a start and end time";

  function chooseSource(next: SourceType) {
    setSourceType(next);
    setError("");
    setSuccess("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");

    try {
      let input: ReductionInput;
      const timing = {
        clipStart: Number(clipStart),
        clipEnd: Number(clipEnd),
        bpm: bpm.trim() === "" ? undefined : Number(bpm),
      };

      if (sourceType === "file") {
        if (!file) throw new Error("Choose an MP3 or WAV file.");
        const extension = file.name.split(".").pop()?.toLowerCase();
        if (extension !== "mp3" && extension !== "wav") {
          throw new Error("Choose an MP3 or WAV file.");
        }
        input = { type: "file", file, ...timing };
      } else {
        input = { type: "youtube", youtubeUrl, ...timing };
      }

      setBusy(true);
      const lesson = await processSource(input);
      onDraft(lesson);
      setSuccess(`Loaded “${lesson.title}” at ${lesson.bpm} BPM.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not process this source.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="source-panel" aria-labelledby="source-panel-title">
      <div className="source-panel__heading">
        <div>
          <p className="source-panel__eyebrow">Source / clip</p>
          <h2 id="source-panel-title">Build from audio</h2>
        </div>
        <span className="source-panel__limit">15s max</span>
      </div>

      <form className="source-panel__form" onSubmit={handleSubmit} noValidate>
        <div className="source-panel__switch" role="radiogroup" aria-label="Audio source">
          <button
            type="button"
            className="tbtn source-panel__switch-button"
            role="radio"
            aria-checked={sourceType === "file"}
            disabled={busy}
            onClick={() => chooseSource("file")}
          >
            File
          </button>
          <button
            type="button"
            className="tbtn source-panel__switch-button"
            role="radio"
            aria-checked={sourceType === "youtube"}
            disabled={busy}
            onClick={() => chooseSource("youtube")}
          >
            YouTube
          </button>
        </div>

        <div className="source-panel__source">
          {sourceType === "file" ? (
            <label key="file" className="source-panel__field source-panel__field--wide">
              <span>MP3 or WAV</span>
              <input
                type="file"
                accept=".mp3,.wav,audio/mpeg,audio/wav,audio/x-wav"
                disabled={busy}
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              />
            </label>
          ) : (
            <label key="youtube" className="source-panel__field source-panel__field--wide">
              <span>YouTube URL</span>
              <input
                type="url"
                inputMode="url"
                value={youtubeUrl}
                placeholder="https://youtube.com/watch?v=…"
                disabled={busy}
                onChange={(event) => setYoutubeUrl(event.target.value)}
              />
            </label>
          )}
        </div>

        <div className="source-panel__clip" aria-describedby="clip-guidance">
          <div className="source-panel__rail" aria-hidden="true">
            {Array.from({ length: RAIL_TICKS }, (_, index) => (
              <span
                key={index}
                className={`source-panel__tick${index < activeTicks ? " is-selected" : ""}`}
              />
            ))}
          </div>
          <output className="source-panel__readout" aria-live="polite">
            {clipReadout}
          </output>
        </div>

        <div className="source-panel__fields">
          <label className="source-panel__field">
            <span>Start · seconds</span>
            <input
              type="number"
              min="0"
              step="0.1"
              value={clipStart}
              disabled={busy}
              onChange={(event) => setClipStart(event.target.value)}
            />
          </label>
          <label className="source-panel__field">
            <span>End · seconds</span>
            <input
              type="number"
              min="0.1"
              step="0.1"
              value={clipEnd}
              disabled={busy}
              onChange={(event) => setClipEnd(event.target.value)}
            />
          </label>
          <label className="source-panel__field">
            <span>BPM · optional</span>
            <input
              type="number"
              min="1"
              step="1"
              value={bpm}
              placeholder="Auto"
              disabled={busy}
              onChange={(event) => setBpm(event.target.value)}
            />
          </label>
        </div>

        <p
          id="clip-guidance"
          className={`source-panel__guidance${durationIsValid ? "" : " is-warning"}`}
        >
          {durationIsValid
            ? "Choose a focused clip up to 15 seconds."
            : "End must be after start, with no more than 15 seconds selected."}
        </p>

        <div className="source-panel__action">
          <button type="submit" className="tbtn source-panel__process" disabled={busy}>
            {busy ? (
              <>
                <span className="source-panel__spinner" aria-hidden="true" />
                Processing audio…
              </>
            ) : (
              "Process"
            )}
          </button>
          <div className="source-panel__status" aria-live="polite" aria-atomic="true">
            {busy ? <p>Keep this page open while the clip is processed.</p> : null}
            {success ? <p className="source-panel__success">{success}</p> : null}
          </div>
        </div>

        {error ? (
          <p className="source-panel__error" role="alert">
            {error}
          </p>
        ) : null}
      </form>
    </section>
  );
}
