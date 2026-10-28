import {
  useEffect,
  useId,
  useRef,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
} from 'react';
import { Icon } from './Icon';

export interface SheetProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  fullHeight?: boolean;
  initialFocusRef?: RefObject<HTMLElement>;
  className?: string;
  ariaLabel?: string;
}

export function Sheet({
  isOpen,
  onClose,
  title,
  description,
  children,
  footer,
  fullHeight = false,
  initialFocusRef,
  className = '',
  ariaLabel,
}: SheetProps) {
  const titleId = useId();
  const descId = useId();
  const sheetRef = useRef<HTMLDivElement>(null);
  const previousActiveElementRef = useRef<HTMLElement | null>(null);

  // Focus trap and previous active element restoration
  useEffect(() => {
    if (!isOpen) return;

    previousActiveElementRef.current = document.activeElement as HTMLElement | null;

    // Focus initial element or first focusable
    const timer = window.setTimeout(() => {
      if (initialFocusRef?.current) {
        initialFocusRef.current.focus();
        return;
      }
      const focusable = sheetRef.current?.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusable && focusable.length > 0) {
        focusable[0].focus();
      } else {
        sheetRef.current?.focus();
      }
    }, 16);

    // Lock body scrolling while open
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      window.clearTimeout(timer);
      document.body.style.overflow = originalOverflow;
      if (previousActiveElementRef.current && typeof previousActiveElementRef.current.focus === 'function') {
        previousActiveElementRef.current.focus();
      }
    };
  }, [isOpen, initialFocusRef]);

  // Escape key handler and Tab focus loop
  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      onClose();
      return;
    }

    if (event.key === 'Tab' && sheetRef.current) {
      const focusable = Array.from(
        sheetRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      ).filter((el) => el.offsetParent !== null || el.getAttribute('tabindex') === '0');

      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }

      const firstElement = focusable[0];
      const lastElement = focusable[focusable.length - 1];

      if (event.shiftKey) {
        if (document.activeElement === firstElement || document.activeElement === sheetRef.current) {
          event.preventDefault();
          lastElement.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          event.preventDefault();
          firstElement.focus();
        }
      }
    }
  }

  if (!isOpen) return null;

  return (
    <div
      className="fb-sheet-portal"
      onKeyDown={handleKeyDown}
      role="presentation"
    >
      {/* Backdrop */}
      <div
        className="fb-sheet-backdrop"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sheet Dialog Surface */}
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-describedby={description ? descId : undefined}
        aria-label={!title ? ariaLabel : undefined}
        tabIndex={-1}
        className={`fb-sheet-surface ${fullHeight ? 'is-full-height' : ''} ${className}`.trim()}
      >
        {/* Grab bar for mobile affordance */}
        <div className="fb-sheet-grab-bar" aria-hidden="true">
          <span className="fb-sheet-grab-handle" />
        </div>

        {/* Header */}
        <div className="fb-sheet-header">
          <div className="fb-sheet-header-text">
            {title && (
              <h2 id={titleId} className="fb-sheet-title">
                {title}
              </h2>
            )}
            {description && (
              <p id={descId} className="fb-sheet-description">
                {description}
              </p>
            )}
          </div>
          <button
            type="button"
            className="fb-sheet-close-btn btn btn-ghost"
            onClick={onClose}
            aria-label="Close sheet"
          >
            <Icon name="close" size={16} />
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="fb-sheet-body">
          {children}
        </div>

        {/* Optional Footer */}
        {footer && (
          <div className="fb-sheet-footer">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
