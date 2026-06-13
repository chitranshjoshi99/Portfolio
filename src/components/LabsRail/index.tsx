import { haptics } from '../../utils/haptics';
import type { LabExperiment } from '../../data/labs';
import './style.css';

interface Props {
  activeIdx: number;
  totalSections: number;
  experiments: LabExperiment[];
  onJump: (idx: number) => void;
  isVisible: boolean;
}

export function LabsRail({ activeIdx, experiments, onJump, isVisible }: Props) {
  const jump = (idx: number) => {
    haptics.tap();
    onJump(idx);
  };

  return (
    <nav
      className={`labs-rail${!isVisible ? ' labs-rail--hidden' : ''}`}
      aria-label="Lab sections"
      aria-hidden={!isVisible}
    >
      {/* Hero dot */}
      <button
        className={`labs-rail__dot${activeIdx === 0 ? ' labs-rail__dot--active' : ''}`}
        onClick={() => jump(0)}
        aria-label="Go to Labs intro"
        title="INIT"
      />

      <div className="labs-rail__sep" aria-hidden="true" />

      {/* One dot per experiment */}
      {experiments.map((exp, i) => {
        const idx = i + 1; // 0 = hero, 1..N = experiments
        const isActive = activeIdx === idx;
        return (
          <button
            key={exp.id}
            className={`labs-rail__dot${isActive ? ' labs-rail__dot--active' : ''}`}
            style={isActive ? { background: exp.accent, borderColor: exp.accent } : undefined}
            onClick={() => jump(idx)}
            aria-label={`Go to ${exp.id.toUpperCase()}`}
            title={exp.id.toUpperCase()}
          />
        );
      })}
    </nav>
  );
}
