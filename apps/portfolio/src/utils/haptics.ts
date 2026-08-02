/**
 * haptics.ts
 * Thin wrapper around the Web Vibration API.
 * All methods are silent no-ops on unsupported platforms
 * (iOS Safari, desktop, older Android WebViews).
 */

const v = (pattern: number | number[]) => {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // API not available — silently skip
  }
};

export const haptics = {
  /** Short confirmation — nav links, small UI interactions */
  tap: () => v(40),

  /** Sustained rattle — shaking the Magic 8-Ball */
  shake: () => v([60, 28, 70, 22, 65, 28, 80, 32, 60, 25, 45]),

  /** Single heavy thud — countdown tick */
  tick: () => v(90),

  /** Multi-pulse reveal — answer appears */
  reveal: () => v([70, 38, 90, 38, 150]),

  /** Light press — CTA buttons, download links */
  press: () => v(30),

  /** Double-pulse — theme toggle */
  toggle: () => v([28, 18, 50]),
};
