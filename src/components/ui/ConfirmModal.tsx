import { useEffect, useRef } from 'react';

export interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'primary' | 'warning';
  isLoading?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}

export function ConfirmModal({
  isOpen,
  title,
  description,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'danger',
  isLoading = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const cancelBtnRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    // Auto-focus cancel button to prevent accidental confirmation on Enter
    const timer = setTimeout(() => {
      cancelBtnRef.current?.focus();
    }, 50);

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && !isLoading) {
        e.preventDefault();
        onCancel();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, isLoading, onCancel]);

  if (!isOpen) return null;

  const confirmBtnClass =
    variant === 'danger'
      ? 'btn btn-danger'
      : variant === 'warning'
        ? 'btn btn-warning'
        : 'btn btn-primary';

  return (
    <div
      className="fb-modal-backdrop"
      onClick={() => {
        if (!isLoading) onCancel();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="fb-modal-title"
    >
      <div
        className="fb-modal-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="fb-modal-header">
          <div className="fb-modal-icon">
            {variant === 'danger' ? '⚠️' : '☕'}
          </div>
          <div>
            <h3 id="fb-modal-title" className="fb-modal-title">{title}</h3>
            <p className="fb-modal-description">{description}</p>
          </div>
        </div>

        <div className="fb-modal-actions">
          <button
            ref={cancelBtnRef}
            type="button"
            className="btn btn-secondary"
            onClick={onCancel}
            disabled={isLoading}
          >
            {cancelText}
          </button>
          <button
            type="button"
            className={confirmBtnClass}
            onClick={() => void onConfirm()}
            disabled={isLoading}
            autoFocus={false}
          >
            {isLoading ? <span className="spinner" style={{ width: 16, height: 16 }} /> : confirmText}
          </button>
        </div>
      </div>

      <style>{`
        .fb-modal-backdrop {
          position: fixed;
          inset: 0;
          z-index: 1000;
          background: rgba(0, 0, 0, 0.55);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: var(--space-4);
          animation: fbModalFadeIn 150ms ease-out;
          overflow-y: auto;
        }

        @keyframes fbModalFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .fb-modal-card {
          width: 100%;
          max-width: 460px;
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-lg, 12px);
          box-shadow: var(--shadow-lg, 0 12px 32px rgba(0, 0, 0, 0.18));
          padding: var(--space-6);
          animation: fbModalScaleIn 180ms cubic-bezier(0.16, 1, 0.3, 1);
        }

        @keyframes fbModalScaleIn {
          from {
            opacity: 0;
            transform: scale(0.96) translateY(6px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }

        .fb-modal-header {
          display: flex;
          gap: var(--space-4);
          align-items: flex-start;
          margin-bottom: var(--space-6);
        }

        .fb-modal-icon {
          font-size: 1.5rem;
          line-height: 1;
          flex-shrink: 0;
          padding-top: 2px;
        }

        .fb-modal-title {
          font-size: 1.125rem;
          font-weight: 700;
          color: var(--color-text-primary);
          margin-bottom: var(--space-2);
          line-height: 1.3;
        }

        .fb-modal-description {
          font-size: 0.875rem;
          color: var(--color-text-secondary);
          line-height: 1.5;
          margin: 0;
        }

        .fb-modal-actions {
          display: flex;
          justify-content: flex-end;
          gap: var(--space-3);
          flex-wrap: wrap;
        }

        @media (max-width: 480px) {
          .fb-modal-card {
            padding: var(--space-5);
          }
          .fb-modal-actions {
            flex-direction: column-reverse;
          }
          .fb-modal-actions > button {
            width: 100%;
            justify-content: center;
          }
        }
      `}</style>
    </div>
  );
}
