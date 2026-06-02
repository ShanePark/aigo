"use client";

import { X } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useId } from "react";

type AppModalProps = {
  children: ReactNode;
  description?: string;
  disabled?: boolean;
  footer?: ReactNode;
  onClose: () => void;
  open: boolean;
  size?: "default" | "wide" | "media";
  title: string;
};

type AppModalActionsProps = {
  children: ReactNode;
  status?: string | null;
};

export function AppModal({ children, description, disabled = false, footer, onClose, open, size = "default", title }: AppModalProps) {
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    if (!open) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !disabled) onClose();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [disabled, onClose, open]);

  if (!open) return null;

  return (
    <div className="app-modal-backdrop" onMouseDown={disabled ? undefined : onClose}>
      <div
        aria-describedby={description ? descriptionId : undefined}
        aria-labelledby={titleId}
        aria-modal="true"
        className={`app-modal-dialog app-modal-${size}`}
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
      >
        <div className="app-modal-head">
          <div className="app-modal-title-block">
            <h2 id={titleId}>{title}</h2>
            {description ? <p id={descriptionId}>{description}</p> : null}
          </div>
          <button aria-label="닫기" className="app-modal-close" disabled={disabled} onClick={onClose} type="button">
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <div className="app-modal-body">{children}</div>
        {footer ? <div className="app-modal-footer">{footer}</div> : null}
      </div>
    </div>
  );
}

export function AppModalActions({ children, status }: AppModalActionsProps) {
  return (
    <div className="app-modal-actions">
      {status ? <p className="app-modal-status">{status}</p> : null}
      <div className="app-modal-button-row">{children}</div>
    </div>
  );
}
