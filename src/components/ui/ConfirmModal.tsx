import { useEffect, useRef } from 'react';
import { Icon } from './Icon';

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
  const cardRef = useRef<HTMLDivElement | null>(null);

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
        return;
      }

      if (e.key === 'Tab' && cardRef.current) {
        const focusable = cardRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        );
        if (focusable.length === 0) return;

        const firstElement = focusable[0];
        const lastElement = focusable[focusable.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            e.preventDefault();
            lastElement.focus();
          }
        } else {
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement.focus();
          }
        }
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
      aria-describedby="fb-modal-description"
    >
      <div
        ref={cardRef}
        className="fb-modal-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="fb-modal-header">
          <div className="fb-modal-icon" aria-hidden="true">
            <Icon name={variant === 'danger' || variant === 'warning' ? 'warning' : 'info'} size={20} />
          </div>
          <div>
            <h3 id="fb-modal-title" className="fb-modal-title">{title}</h3>
            <p id="fb-modal-description" className="fb-modal-description">{description}</p>
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
    </div>
  );
}
