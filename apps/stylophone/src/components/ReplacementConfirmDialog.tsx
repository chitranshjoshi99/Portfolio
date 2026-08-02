import type { BeatDocument } from "../lib/document";

type PendingReplacement =
  | { kind: "new" | "reset" }
  | { kind: "import"; document: BeatDocument };

export default function ReplacementConfirmDialog({
  pendingReplacement,
  onExportBackup,
  onCancel,
  onConfirm,
}: {
  pendingReplacement: PendingReplacement | null;
  onExportBackup: () => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <section className="lesson-lib" aria-label="Confirm draft replacement">
      <p className="lesson-lib__hint">
        {pendingReplacement?.kind === "import"
          ? "Importing replaces the current local draft. Export a backup first if you want to keep these unsaved changes."
          : "This replaces the current local draft with a blank beat. Export a backup first if you want to keep these unsaved changes."}
      </p>
      <div className="lesson-lib__save">
        <button type="button" className="tbtn" onClick={onExportBackup}>
          Export backup
        </button>
        <button type="button" className="tbtn" onClick={onCancel}>
          Cancel
        </button>
        <button type="button" className="tbtn" onClick={onConfirm}>
          {pendingReplacement?.kind === "import"
            ? "Import anyway"
            : pendingReplacement?.kind === "reset"
              ? "Reset anyway"
              : "New beat anyway"}
        </button>
      </div>
    </section>
  );
}
