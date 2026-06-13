import { useState } from 'react';
import { haptics } from '../../utils/haptics';
import { CodePanel } from '../CodePanel';
import type { LabExperiment } from '../../data/labs';
import './style.css';

interface Props {
  experiment: LabExperiment;
}

const STATUS_GLYPHS: Record<LabExperiment['status'], string> = {
  RUNNING: '●',
  WRITING: '◎',
  OFFLINE: '◌',
};

export function SceneText({ experiment: exp }: Props) {
  const [expanded, setExpanded] = useState(false);

  const toggle = () => {
    setExpanded((v) => !v);
    haptics.tap();
  };

  const channelLabel =
    exp.render === 'tv'
      ? `CH ${String(exp.channel).padStart(2, '0')}`
      : 'TOY';

  const filename = `${exp.id}.loop.ts`;

  return (
    <div className="scene-text">
      <div className="scene-text__meta pixel-text">
        <span className="scene-text__channel">{channelLabel}</span>
        <span className="scene-text__badge" style={{ color: exp.accent }}>
          {STATUS_GLYPHS[exp.status]} {exp.status}
        </span>
      </div>

      <h2 className="pixel-text scene-text__title">{exp.title}</h2>
      <p className="vt-text scene-text__teaser">{exp.teaser}</p>

      <button
        className="pixel-text scene-text__toggle"
        aria-expanded={expanded}
        onClick={toggle}
      >
        {expanded ? '▾ HIDE LOGIC' : '▸ SHOW LOGIC'}
      </button>

      {expanded && (
        <div className="scene-text__code-wrap">
          <CodePanel code={exp.code} filename={filename} />
        </div>
      )}
    </div>
  );
}
