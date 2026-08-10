interface DemoControlsProps {
  bypassClientChecks: boolean;
  onToggleBypass: () => void;
  onResetData: () => void;
}

export function DemoControls({ bypassClientChecks, onToggleBypass, onResetData }: DemoControlsProps) {
  return (
    <div className="ff__demo">
      <label className="ff__toggle">
        <input type="checkbox" checked={bypassClientChecks} onChange={onToggleBypass} />
        Bypass client permission checks
      </label>
      <span className="ff__demo-note">
        Enables every control regardless of role — the server still rejects what the role cannot do.
      </span>
      <button type="button" className="ff__link" onClick={onResetData}>
        Reset data
      </button>
    </div>
  );
}
