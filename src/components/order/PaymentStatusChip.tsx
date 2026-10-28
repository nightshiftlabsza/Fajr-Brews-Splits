import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import type { PaymentStatus } from '../../types';
import { Icon } from '../ui/Icon';

interface PaymentStatusChipProps {
  status: PaymentStatus;
  onStatusChange?: (newStatus: PaymentStatus) => void;
  readOnly?: boolean;
  disabled?: boolean;
  personName?: string;
  className?: string;
}

const STATUS_CONFIG: Record<
  PaymentStatus,
  { label: string; toneClass: string; iconName: 'check' | 'warning' | 'clock' }
> = {
  unpaid: {
    label: 'Unpaid',
    toneClass: 'is-unpaid',
    iconName: 'clock',
  },
  partial: {
    label: 'Partly paid',
    toneClass: 'is-partial',
    iconName: 'warning',
  },
  paid: {
    label: 'Paid',
    toneClass: 'is-paid',
    iconName: 'check',
  },
};

const OPTIONS: PaymentStatus[] = ['unpaid', 'partial', 'paid'];

export function PaymentStatusChip({
  status,
  onStatusChange,
  readOnly = false,
  disabled = false,
  personName,
  className = '',
}: PaymentStatusChipProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const canEdit = !readOnly && !disabled && Boolean(onStatusChange);
  const currentConfig = STATUS_CONFIG[status] || STATUS_CONFIG.unpaid;

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    function handlePointerDown(e: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [isOpen]);

  function handleSelect(option: PaymentStatus) {
    setIsOpen(false);
    triggerRef.current?.focus();
    if (option !== status && onStatusChange) {
      onStatusChange(option);
    }
  }

  function handleTriggerKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
    if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setIsOpen(true);
      setTimeout(() => {
        const firstBtn = menuRef.current?.querySelector<HTMLButtonElement>('button');
        firstBtn?.focus();
      }, 16);
    }
  }

  function handleMenuKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
      triggerRef.current?.focus();
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const buttons = Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>('button') || []);
      if (buttons.length === 0) return;
      const currentIndex = buttons.indexOf(document.activeElement as HTMLButtonElement);
      const nextIndex =
        currentIndex >= 0
          ? e.key === 'ArrowDown'
            ? (currentIndex + 1) % buttons.length
            : (currentIndex - 1 + buttons.length) % buttons.length
          : 0;
      buttons[nextIndex]?.focus();
    }
  }

  if (!canEdit) {
    return (
      <span
        className={`fb-status-chip ${currentConfig.toneClass} ${className}`.trim()}
        aria-label={personName ? `Payment status for ${personName}: ${currentConfig.label}` : currentConfig.label}
      >
        <span className="fb-status-chip-icon" aria-hidden="true">
          <Icon name={currentConfig.iconName} size={12} />
        </span>
        <span className="fb-status-chip-label">{currentConfig.label}</span>
      </span>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`fb-status-chip-container ${isOpen ? 'is-menu-open' : ''} ${className}`.trim()}
    >
      <button
        ref={triggerRef}
        type="button"
        className={`fb-status-chip fb-status-chip-btn ${currentConfig.toneClass}`}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-label={
          personName
            ? `Change payment status for ${personName}. Current status: ${currentConfig.label}`
            : `Change payment status. Current: ${currentConfig.label}`
        }
        onClick={() => setIsOpen((prev) => !prev)}
        onKeyDown={handleTriggerKeyDown}
      >
        <span className="fb-status-chip-icon" aria-hidden="true">
          <Icon name={currentConfig.iconName} size={12} />
        </span>
        <span className="fb-status-chip-label">{currentConfig.label}</span>
        <span className="fb-status-chip-chevron" aria-hidden="true">
          <Icon name={isOpen ? 'chevron-up' : 'chevron-down'} size={11} />
        </span>
      </button>

      {isOpen && (
        <div
          ref={menuRef}
          role="menu"
          className="fb-status-chip-menu"
          aria-label={personName ? `Payment options for ${personName}` : 'Payment options'}
          onKeyDown={handleMenuKeyDown}
        >
          {OPTIONS.map((opt) => {
            const config = STATUS_CONFIG[opt];
            const isSelected = opt === status;

            return (
              <button
                key={opt}
                type="button"
                role="menuitem"
                className={`fb-status-chip-menu-item ${config.toneClass} ${isSelected ? 'is-selected' : ''}`}
                onClick={() => handleSelect(opt)}
              >
                <span className="fb-status-chip-icon" aria-hidden="true">
                  <Icon name={config.iconName} size={12} />
                </span>
                <span className="fb-status-chip-item-label">{config.label}</span>
                {isSelected && (
                  <span className="fb-status-chip-item-check" aria-hidden="true">
                    <Icon name="check" size={13} />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
