import type { RefObject } from 'react';
import { DEMO_MIN_WIDTH } from '../utils/css-tasks.utils';

interface TaskPreviewProps {
  title: string;
  srcDoc: string;
  width: number;
  maxWidth: number;
  presets: number[];
  runKey: number;
  stageRef: RefObject<HTMLDivElement>;
  onWidth: (width: number) => void;
  onReload: () => void;
}

export function TaskPreview({
  title, srcDoc, width, maxWidth, presets, runKey, stageRef, onWidth, onReload,
}: TaskPreviewProps) {
  return (
    <div className="kc__preview">
      <div className="kc__ruler">
        <label className="kc__slider">
          <span className="kc__sr">Preview width</span>
          <input
            type="range"
            min={DEMO_MIN_WIDTH}
            max={maxWidth}
            step={5}
            value={width}
            onChange={(event) => onWidth(Number(event.target.value))}
          />
        </label>
        <span className="kc__width">{width}px</span>
        {presets.map((preset) => (
          <button
            key={preset}
            type="button"
            className={`kc__preset ${width === preset ? 'is-on' : ''}`}
            onClick={() => onWidth(preset)}
          >
            {preset}
          </button>
        ))}
        <button type="button" className="kc__preset" onClick={onReload}>
          ↺ reset
        </button>
      </div>

      <div className="kc__stage" ref={stageRef}>
        <iframe
          key={runKey}
          className="kc__frame"
          style={{ width }}
          title={`${title} preview`}
          srcDoc={srcDoc}
          /* No allow-same-origin: the demo cannot reach this app, and localStorage throws inside —
             which is exactly the case the cookie banner has to survive. */
          sandbox="allow-scripts allow-forms"
        />
      </div>
    </div>
  );
}
