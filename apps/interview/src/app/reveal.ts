export const REVEAL_KEY = 'revealInterviewApp';

/**
 * This app ships alongside the portfolio on the same domain, and the portfolio gets shared. The flag
 * keeps it out of sight of anyone who wanders in.
 *
 * It is concealment, not protection: the bundle is still served, so anyone reading the network tab or
 * guessing a chunk URL can read the source. Anything that must actually stay private has to stop being
 * deployed, or sit behind a real login.
 */
export function isRevealed(storage: Pick<Storage, 'getItem'> | undefined = safeStorage()): boolean {
  if (!storage) return false;
  try {
    const value = storage.getItem(REVEAL_KEY);
    // Accept what a human would type into the console; anything else is a no.
    return value === 'true' || value === '1';
  } catch {
    return false;
  }
}

/** Storage access throws outright in some privacy modes and in sandboxed frames — not just returns null. */
function safeStorage(): Storage | undefined {
  try {
    return typeof localStorage === 'undefined' ? undefined : localStorage;
  } catch {
    return undefined;
  }
}
