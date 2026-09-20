import catalog from "../../../catalog.json";

export type PublishedApp = {
  project: string;
  slug: string;
  name: string;
  label: string;
  description: string;
  accent: string;
  /** Kept out of the Apps listing unless the reader has set the reveal flag. */
  hidden?: boolean;
};

export const REVEAL_KEY = "revealInterviewApp";

/**
 * Duplicated from apps/interview/src/app/reveal.ts on purpose: the two apps are separate builds and
 * share no code. Keep the two in step if the key or the accepted values ever change.
 *
 * This hides a card, it does not protect anything: the app is still deployed and still reachable by
 * URL. Storage access throws outright in some privacy modes, so every read is guarded.
 */
function isRevealed(): boolean {
  try {
    const value = localStorage.getItem(REVEAL_KEY);
    return value === "true" || value === "1";
  } catch {
    return false;
  }
}

const published = catalog.apps as PublishedApp[];

// Evaluated once on load: flipping the flag in the console needs a refresh, same as the app itself.
export const PUBLISHED_APPS = published.filter((app) => !app.hidden || isRevealed());
