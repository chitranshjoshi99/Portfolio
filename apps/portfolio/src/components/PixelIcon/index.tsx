import "./style.css";

/**
 * Pixel-art icon set, replaces the emoji that used to sit inline in copy.
 *
 * Emoji render in the OS colour font, so they ignored the theme, broke the
 * monochrome palette, and changed shape per platform. These are 8×8 rect
 * grids drawn with `currentColor` and `shapeRendering="crispEdges"`, so they
 * inherit text colour, stay pixel-crisp at any integer size, and match the
 * rest of the app's 4px grid.
 */
export type PixelIconName =
  | "calendar"
  | "pin"
  | "cap"
  | "phone"
  | "mail"
  | "code"
  | "location";

// Each entry is a list of [x, y, w, h] rects on an 8×8 grid.
type Rect = [number, number, number, number];

const ICONS: Record<PixelIconName, Rect[]> = {
  // Calendar: two tabs, a frame, a divider row and a marked day.
  calendar: [
    [1, 0, 1, 2],
    [6, 0, 1, 2],
    [0, 1, 8, 1],
    [0, 1, 1, 7],
    [7, 1, 1, 7],
    [0, 7, 8, 1],
    [0, 3, 8, 1],
    [2, 5, 2, 2],
  ],
  // Map pin: round head, tapered stem, hollow centre.
  pin: [
    [2, 0, 4, 1],
    [1, 1, 1, 3],
    [6, 1, 1, 3],
    [2, 4, 1, 1],
    [5, 4, 1, 1],
    [3, 5, 2, 1],
    [3, 6, 2, 2],
    [3, 2, 2, 2],
  ],
  location: [
    [2, 0, 4, 1],
    [1, 1, 1, 3],
    [6, 1, 1, 3],
    [2, 4, 1, 1],
    [5, 4, 1, 1],
    [3, 5, 2, 1],
    [3, 6, 2, 2],
    [3, 2, 2, 2],
  ],
  // Graduation cap: mortarboard, band, tassel.
  cap: [
    [2, 0, 4, 1],
    [1, 1, 6, 1],
    [0, 2, 8, 1],
    [2, 3, 4, 1],
    [2, 4, 4, 2],
    [7, 3, 1, 3],
  ],
  // Handset drawn as a diagonal: earpiece, shaft, mouthpiece.
  phone: [
    [0, 0, 3, 2],
    [2, 2, 2, 2],
    [4, 4, 2, 2],
    [5, 6, 3, 2],
  ],
  // Envelope: frame + folded flap.
  mail: [
    [0, 1, 8, 1],
    [0, 1, 1, 6],
    [7, 1, 1, 6],
    [0, 6, 8, 1],
    [1, 2, 1, 1],
    [6, 2, 1, 1],
    [2, 3, 1, 1],
    [5, 3, 1, 1],
    [3, 4, 2, 1],
  ],
  // Angle brackets.
  code: [
    [2, 1, 1, 1],
    [1, 2, 1, 1],
    [0, 3, 1, 2],
    [1, 5, 1, 1],
    [2, 6, 1, 1],
    [5, 1, 1, 1],
    [6, 2, 1, 1],
    [7, 3, 1, 2],
    [6, 5, 1, 1],
    [5, 6, 1, 1],
  ],
};

interface Props {
  name: PixelIconName;
  /** Rendered box in px, keep to multiples of 8 so pixels stay square. */
  size?: number;
  className?: string;
  /** Only pass when the icon is the sole carrier of meaning. */
  title?: string;
}

export function PixelIcon({ name, size = 16, className, title }: Props) {
  return (
    <svg
      className={`pixel-icon${className ? ` ${className}` : ""}`}
      width={size}
      height={size}
      viewBox="0 0 8 8"
      shapeRendering="crispEdges"
      fill="currentColor"
      role={title ? "img" : "presentation"}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      focusable="false"
    >
      {title && <title>{title}</title>}
      {ICONS[name].map(([x, y, w, h], i) => (
        <rect key={i} x={x} y={y} width={w} height={h} />
      ))}
    </svg>
  );
}
