#!/usr/bin/env python3
"""Render public/favicon.png: the BeatPad visualizer as a 64x64 icon.

ponytail: no Pillow, no SVG rasterizer on this box — the pad is analytic
(radii + angles), so classifying supersampled pixels and deflating the rows
by hand is shorter than adding an image dependency. Geometry constants are
copied from src/components/BeatPad.tsx; keep them in sync if the pad changes.
"""
import math
import struct
import zlib
from pathlib import Path

# --- BeatPad.tsx geometry, in its 320x320 viewBox ---------------------------
C = 160.0
R_OUT, R_MID, R_IN = 150.0, 103.0, 56.0
NAT_STEP = 360.0 / 7
HALF_WIDTH = 34.0
HALF_CENTERS = [i * NAT_STEP for i in (1, 2, 4, 5, 6)]

# --- theme.css palette ------------------------------------------------------
SURFACE = (0x23, 0x23, 0x23)   # natural key
BG_2 = (0x1B, 0x1B, 0x1B)      # half-step key, and the centre disc
EDGE = (0x36, 0x36, 0x36)      # key outline
SURFACE_2 = (0x2B, 0x2B, 0x2B) # half-step outline
ACCENT = (0xD9, 0x77, 0x57)    # pad 1, so the mark still reads at 16px

SIZE = 64
SS = 4                  # supersampling factor per axis
PAD = 6.0               # viewBox inset: the ring runs edge to edge
STROKE = 2.0            # outline half-width, in viewBox units


def sample(x, y):
    """Colour of one viewBox point, or None for transparent."""
    dx, dy = x - C, y - C
    r = math.hypot(dx, dy)
    if r > R_OUT + STROKE:
        return None

    deg = (math.degrees(math.atan2(dy, dx)) + 90.0) % 360.0

    # Half-step keys sit on top of the naturals, in the outer band only —
    # same layering order padAtPoint() uses.
    for centre in HALF_CENTERS:
        off = abs((deg - centre + 180.0) % 360.0 - 180.0)
        if r >= R_MID - STROKE and off <= HALF_WIDTH / 2 + STROKE:
            on_edge = (off > HALF_WIDTH / 2 - STROKE
                       or abs(r - R_MID) < STROKE
                       or abs(r - R_OUT) < STROKE)
            return SURFACE_2 if on_edge else BG_2

    if r < R_IN - STROKE:
        return BG_2                      # the centre disc
    if abs(r - R_IN) < STROKE:
        return EDGE                      # its rim
    if abs(r - R_OUT) < STROKE:
        return EDGE                      # outer rim

    sector = int(deg // NAT_STEP) % 7
    if abs(deg % NAT_STEP) < STROKE / 2 or abs(NAT_STEP - deg % NAT_STEP) < STROKE / 2:
        return EDGE                      # the seam between two naturals
    return ACCENT if sector == 0 else SURFACE


def render():
    """Supersample into straight RGBA rows."""
    span = 320.0 - 2 * PAD
    rows = []
    for py in range(SIZE):
        row = bytearray()
        for px in range(SIZE):
            r = g = b = a = 0
            for sy in range(SS):
                for sx in range(SS):
                    vx = PAD + (px + (sx + 0.5) / SS) / SIZE * span
                    vy = PAD + (py + (sy + 0.5) / SS) / SIZE * span
                    c = sample(vx, vy)
                    if c:
                        r += c[0]
                        g += c[1]
                        b += c[2]
                        a += 255
            n = SS * SS
            if a:
                lit = a // 255
                row += bytes((r // lit, g // lit, b // lit, a // n))
            else:
                row += b"\0\0\0\0"
        rows.append(bytes(row))
    return rows


def png(rows):
    def chunk(tag, data):
        body = tag + data
        return struct.pack(">I", len(data)) + body + struct.pack(">I", zlib.crc32(body))

    raw = b"".join(b"\0" + r for r in rows)          # filter type 0 per row
    return (b"\x89PNG\r\n\x1a\n"
            + chunk(b"IHDR", struct.pack(">IIBBBBB", SIZE, SIZE, 8, 6, 0, 0, 0))
            + chunk(b"IDAT", zlib.compress(raw, 9))
            + chunk(b"IEND", b""))


if __name__ == "__main__":
    out = Path(__file__).resolve().parent.parent / "public" / "favicon.png"
    out.write_bytes(png(render()))
    print(f"wrote {out} ({out.stat().st_size} bytes)")
