"use client";

import { AlertTriangle, X } from "lucide-react";
import { useEffect, useId } from "react";

type ConfirmDialogProps = {
  body: string;
  cancelLabel?: string;
  confirmLabel?: string;
  disabled?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  open: boolean;
  title: string;
  tone?: "danger" | "neutral";
};

export function ConfirmDialog({
  body,
  cancelLabel = "취소",
  confirmLabel = "확인",
  disabled = false,
  onCancel,
  onConfirm,
  open,
  title,
  tone = "neutral"
}: ConfirmDialogProps) {
  const titleId = useId();
  const bodyId = useId();

  useEffect(() => {
    if (!open) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !disabled) onCancel();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [disabled, onCancel, open]);

  if (!open) return null;

  return (
    <div className="app-confirm-backdrop" onMouseDown={disabled ? undefined : onCancel}>
      <div
        aria-describedby={bodyId}
        aria-labelledby={titleId}
        aria-modal="true"
        className={`app-confirm-dialog ${tone === "danger" ? "is-danger" : ""}`}
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
      >
        <div className="app-confirm-icon" aria-hidden="true">
          <AlertTriangle size={20} />
        </div>
        <div className="app-confirm-copy">
          <div className="app-confirm-title-row">
            <h2 id={titleId}>{title}</h2>
            <button aria-label="닫기" className="app-confirm-close" disabled={disabled} onClick={onCancel} type="button">
              <X size={17} aria-hidden="true" />
            </button>
          </div>
          <p id={bodyId}>{body}</p>
          <div className="app-confirm-actions">
            <button className="app-confirm-cancel" disabled={disabled} onClick={onCancel} type="button">
              {cancelLabel}
            </button>
            <button className="app-confirm-submit" disabled={disabled} onClick={onConfirm} type="button">
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
