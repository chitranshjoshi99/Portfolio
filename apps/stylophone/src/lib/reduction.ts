import { validateLesson, type Lesson } from "./lesson";

type SourceInput =
  | { type: "file"; file: File; youtubeUrl?: never }
  | { type: "youtube"; youtubeUrl: string; file?: never };

export type ReductionInput = SourceInput & {
  clipStart: number;
  clipEnd: number;
  bpm?: number;
  title?: string;
  signal?: AbortSignal;
};

const REDUCE_URL = "http://127.0.0.1:8000/reduce";
const MAX_CLIP_SECONDS = 15;

function validateInput(input: ReductionInput): void {
  const { clipStart, clipEnd, bpm } = input;

  if (!Number.isFinite(clipStart) || clipStart < 0) {
    throw new Error("Clip start must be a finite, non-negative number.");
  }
  if (!Number.isFinite(clipEnd) || clipEnd <= clipStart) {
    throw new Error("Clip end must be finite and greater than clip start.");
  }
  if (clipEnd - clipStart > MAX_CLIP_SECONDS) {
    throw new Error("Clip duration must be 15 seconds or less.");
  }
  if (bpm !== undefined && (!Number.isFinite(bpm) || bpm <= 0)) {
    throw new Error("BPM must be a finite number greater than zero.");
  }

  if (input.type === "file") {
    if (!(input.file instanceof File) || !input.file.name.trim() || input.file.size === 0) {
      throw new Error("Choose a non-empty audio file.");
    }
    if ("youtubeUrl" in input) {
      throw new Error("Provide exactly one file or YouTube URL.");
    }
    return;
  }

  if (input.type === "youtube") {
    if (typeof input.youtubeUrl !== "string" || !input.youtubeUrl.trim()) {
      throw new Error("Enter a nonblank YouTube URL.");
    }
    if ("file" in input) {
      throw new Error("Provide exactly one file or YouTube URL.");
    }
    return;
  }

  throw new Error("Provide exactly one file or YouTube URL.");
}

function responseDetail(payload: unknown): string | undefined {
  if (typeof payload !== "object" || payload === null || !("detail" in payload)) return undefined;
  const detail = (payload as { detail?: unknown }).detail;
  return typeof detail === "string" && detail.trim() ? detail : undefined;
}

export async function processSource(input: ReductionInput): Promise<Lesson> {
  validateInput(input);

  const form = new FormData();
  if (input.type === "file") {
    form.append("file", input.file);
  } else {
    form.append("youtube_url", input.youtubeUrl.trim());
  }
  form.append("clip_start", String(input.clipStart));
  form.append("clip_end", String(input.clipEnd));
  if (input.bpm !== undefined) form.append("bpm", String(input.bpm));

  const response = await fetch(REDUCE_URL, {
    method: "POST",
    body: form,
    signal: input.signal,
  });

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    if (!response.ok) {
      throw new Error(`Reduction failed (HTTP ${response.status}).`);
    }
    throw new Error("Reduction service returned invalid JSON.");
  }

  if (!response.ok) {
    throw new Error(responseDetail(payload) ?? `Reduction failed (HTTP ${response.status}).`);
  }
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
    throw new Error("Reduction service returned an invalid draft.");
  }

  const explicitTitle = input.title?.trim();
  const fileTitle = input.type === "file"
    ? input.file.name.replace(/\.[^/.]+$/, "").trim()
    : undefined;
  const candidate = {
    ...payload,
    id: crypto.randomUUID(),
    title: explicitTitle || fileTitle || (input.type === "youtube" ? "YouTube draft" : "Audio draft"),
  };
  const result = validateLesson(candidate);
  if (!result.ok) {
    throw new Error(`Reduction service returned an invalid draft: ${result.error}`);
  }
  return result.lesson;
}
