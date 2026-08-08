// Generic utility dialog (R9): native <dialog> gives focus trap, Escape-to-close,
// and focus-return-to-launcher for free, so this wrapper only adds the themed
// chrome + backdrop-click-to-close on top of it.
import { useEffect, useId, useRef, type ReactNode } from "react";
import "./Modal.css";

type ModalProps = {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
};

export default function Modal({ open, title, onClose, children }: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  // Escape fires the native 'cancel' then 'close' events; the overlay/close
  // button call dialog.close() directly. Either path lands here, so React
  // state (`open`) never drifts from the dialog's real open state.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const handleClose = () => onClose();
    dialog.addEventListener("close", handleClose);
    return () => dialog.removeEventListener("close", handleClose);
  }, [onClose]);

  // The dialog element is sized to the full viewport (see Modal.css) so a click
  // in the empty space around the panel lands on the dialog itself, not a
  // descendant — that's what distinguishes an overlay click from a panel click.
  function handleOverlayClick(e: React.MouseEvent<HTMLDialogElement>) {
    if (e.target === dialogRef.current) dialogRef.current?.close();
  }

  return (
    <dialog
      ref={dialogRef}
      className="modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={handleOverlayClick}
    >
      <div className="modal__panel">
        <div className="modal__header">
          <h2 className="modal__title" id={titleId}>
            {title}
          </h2>
          <button
            type="button"
            className="tbtn tbtn--icon"
            aria-label="Close"
            title="Close"
            data-tip="Close"
            onClick={() => dialogRef.current?.close()}
          >
            ×
          </button>
        </div>
        <div className="modal__body">{children}</div>
      </div>
    </dialog>
  );
}
