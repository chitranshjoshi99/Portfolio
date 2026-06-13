import { useEffect, useRef } from 'react';
import './style.css';

interface Props {
  width?: number;
  height?: number;
}

// Canvas-based TV static noise — runs only while mounted.
// Extract from Labs and mount only during a channel-change burst.
export function ChannelStatic({ width = 60, height = 45 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;

    function drawNoise() {
      const img = ctx!.createImageData(W, H);
      const d = img.data;
      for (let i = 0; i < d.length; i += 4) {
        const r = Math.random();
        const v =
          r < 0.55
            ? Math.floor(Math.random() * 30)
            : r < 0.78
              ? 60 + Math.floor(Math.random() * 80)
              : 150 + Math.floor(Math.random() * 105);
        d[i] = v;
        d[i + 1] = v;
        d[i + 2] = v;
        d[i + 3] = 255;
      }
      ctx!.putImageData(img, 0, 0);
      rafRef.current = requestAnimationFrame(drawNoise);
    }

    drawNoise();
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="channel-static"
      width={width}
      height={height}
      aria-hidden="true"
    />
  );
}
