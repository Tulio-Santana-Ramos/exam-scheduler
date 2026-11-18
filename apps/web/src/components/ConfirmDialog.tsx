import { useEffect, useRef } from 'react';
import type { ConfirmRequest } from '../hooks/confirm';

export function ConfirmDialog({ request, onClose }: { request: ConfirmRequest | null; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (request && !dialog.open) dialog.showModal();
    if (!request && dialog.open) dialog.close();
  }, [request]);

  function confirm() {
    request?.onConfirm();
    onClose();
  }

  return (
    <dialog ref={ref} onClose={onClose} aria-labelledby="confirm-title">
      {request && (
        <>
          <h2 id="confirm-title">{request.title}</h2>
          <p className="muted">{request.message}</p>
          <div className="form-actions">
            <button type="button" className="secondary" onClick={onClose}>Voltar</button>
            <button type="button" className={request.tone === 'danger' ? 'danger' : undefined} onClick={confirm}>
              {request.confirmLabel}
            </button>
          </div>
        </>
      )}
    </dialog>
  );
}
