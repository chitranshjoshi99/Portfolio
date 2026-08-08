interface DemoControlsProps {
  failuresForced: boolean;
  onToggleFailures: () => void;
  onResetData: () => void;
}

/** Drives the fake backend, not the product. Kept visually separate for that reason. */
export function DemoControls({ failuresForced, onToggleFailures, onResetData }: DemoControlsProps) {
  return (
    <div className="console__demo">
      <label className="console__toggle">
        <input type="checkbox" checked={failuresForced} onChange={onToggleFailures} />
        Force API failures
      </label>
      <button type="button" className="link" onClick={onResetData}>
        Reset demo data
      </button>
    </div>
  );
}
