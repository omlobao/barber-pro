import React, { useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export function ModalDialog({
  open,
  onClose,
  title,
  subtitle,
  children,
  maxWidth = 'max-w-lg',
}) {
  const dialogRef = useRef(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return undefined;

    const handleClose = () => {
      dialog.returnValue = '';
      onClose?.();
    };

    dialog.addEventListener('close', handleClose);

    // Fallback for light-dismiss where native dialog[closedby="any"] is unsupported
    let pressedOutside = false;
    const isOutside = (e) => {
      const r = dialog.getBoundingClientRect();
      return (
        e.clientX < r.left ||
        e.clientX > r.right ||
        e.clientY < r.top ||
        e.clientY > r.bottom
      );
    };
    const onPointerDown = (e) => {
      pressedOutside = isOutside(e);
    };
    const onPointerUp = (e) => {
      if (pressedOutside && isOutside(e)) {
        dialog.close();
      }
      pressedOutside = false;
    };

    if (!('closedBy' in HTMLDialogElement.prototype)) {
      dialog.addEventListener('pointerdown', onPointerDown);
      dialog.addEventListener('pointerup', onPointerUp);
    }

    return () => {
      dialog.removeEventListener('close', handleClose);
      dialog.removeEventListener('pointerdown', onPointerDown);
      dialog.removeEventListener('pointerup', onPointerUp);
    };
  }, [onClose]);

  return (
    <dialog
      ref={dialogRef}
      closedby="any"
      aria-labelledby={titleId}
      className={cn(
        'm-auto w-[calc(100%-2rem)] rounded-2xl border border-[#232730] bg-[#14171D] p-0 text-[#F8FAFC] shadow-2xl open:block',
        maxWidth
      )}
    >
      <div className="flex items-start justify-between border-b border-[#232730] px-6 py-4">
        <div>
          <h1 id={titleId} className="text-lg font-bold text-[#F8FAFC]">
            {title}
          </h1>
          {subtitle ? (
            <p className="mt-0.5 text-xs text-[#94A3B8]">{subtitle}</p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => dialogRef.current?.close()}
          aria-label="Fechar janela"
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#232730] bg-[#0B0D10]/60 text-[#94A3B8] transition hover:border-[#D97706]/50 hover:text-[#F8FAFC]"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="p-6">{children}</div>
    </dialog>
  );
}
