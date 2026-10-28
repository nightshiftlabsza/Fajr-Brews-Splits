import { forwardRef, useEffect, useImperativeHandle, useRef, useState, type KeyboardEvent } from 'react';
import type { Order } from '../../types';
import { isStepComplete } from '../../lib/orderWizard';
import { Icon } from '../ui/Icon';

export type StepTabId = 'setup' | 'coffees' | 'goods' | 'summary' | 'invoices';

export interface StepTabItem {
  id: StepTabId;
  label: string;
  badgeCount?: number;
  isDone: boolean;
  isLocked: boolean;
  lockedReason?: string;
}

interface StepTabsProps {
  currentStep: StepTabId;
  order: Order;
  onSelectStep: (step: StepTabId) => void;
  className?: string;
}

export function computeStepItems(order: Order): StepTabItem[] {
  const isSetupDone = isStepComplete(order, 'setup');
  const isCoffeesDone = isStepComplete(order, 'coffees');
  const isGoodsDone = isStepComplete(order, 'goods');
  const isSummaryDone = isStepComplete(order, 'summary');

  let coffeesLockedReason = '';
  if (!isSetupDone) {
    coffeesLockedReason = 'Complete setup first';
  }

  let goodsLockedReason = '';
  if (!isSetupDone) {
    goodsLockedReason = 'Complete setup first';
  } else if (order.lots.length === 0) {
    goodsLockedReason = 'Add a coffee first';
  } else if (!isCoffeesDone) {
    goodsLockedReason = 'Assign coffee bags first';
  }

  let summaryLockedReason = '';
  if (!isCoffeesDone) {
    summaryLockedReason = order.lots.length === 0 ? 'Add a coffee first' : 'Assign coffee bags first';
  } else if (!(order.goodsTotalZar > 0)) {
    summaryLockedReason = 'Enter goods total first';
  } else if (!isGoodsDone) {
    summaryLockedReason = 'Complete goods and fees first';
  }

  let invoicesLockedReason = '';
  if (!isSummaryDone) {
    if (order.lots.length === 0) {
      invoicesLockedReason = 'Add a coffee first';
    } else if (!isCoffeesDone) {
      invoicesLockedReason = 'Assign coffee bags first';
    } else if (!(order.goodsTotalZar > 0)) {
      invoicesLockedReason = 'Enter goods total first';
    } else {
      invoicesLockedReason = 'Complete order summary first';
    }
  }

  return [
    {
      id: 'setup',
      label: '1. Setup',
      isDone: isSetupDone,
      isLocked: false,
    },
    {
      id: 'coffees',
      label: '2. Coffees & Bags',
      badgeCount: order.lots.length > 0 ? order.lots.length : undefined,
      isDone: isCoffeesDone,
      isLocked: !isSetupDone,
      lockedReason: coffeesLockedReason || undefined,
    },
    {
      id: 'goods',
      label: '3. Goods & Fees',
      badgeCount: order.fees.length > 0 ? order.fees.length : undefined,
      isDone: isGoodsDone,
      isLocked: !isSetupDone || !isCoffeesDone,
      lockedReason: goodsLockedReason || undefined,
    },
    {
      id: 'summary',
      label: '4. Summary',
      isDone: isSummaryDone,
      isLocked: !isSetupDone || !isCoffeesDone || !isGoodsDone,
      lockedReason: summaryLockedReason || undefined,
    },
    {
      id: 'invoices',
      label: 'Invoices',
      isDone: isSummaryDone,
      isLocked: !isSummaryDone,
      lockedReason: invoicesLockedReason || undefined,
    },
  ];
}

export const StepTabs = forwardRef<HTMLElement, StepTabsProps>(function StepTabs(
  {
    currentStep,
    order,
    onSelectStep,
    className = '',
  }: StepTabsProps,
  ref
) {
  const steps = computeStepItems(order);
  const [activeTooltipStep, setActiveTooltipStep] = useState<StepTabId | null>(null);
  const [announcedMessage, setAnnouncedMessage] = useState<string>('');
  const navRef = useRef<HTMLElement>(null);
  const tabRefs = useRef<Map<StepTabId, HTMLButtonElement>>(new Map());
  const tooltipTimerRef = useRef<number | null>(null);

  useImperativeHandle(ref, () => navRef.current as HTMLElement, []);

  // Clear tooltip when clicking elsewhere
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as HTMLElement | null;
      if (target && !target.closest('.step-tabs-nav')) {
        setActiveTooltipStep(null);
      }
    }
    document.addEventListener('pointerdown', handleClickOutside);
    return () => {
      document.removeEventListener('pointerdown', handleClickOutside);
      if (tooltipTimerRef.current) window.clearTimeout(tooltipTimerRef.current);
    };
  }, []);

  function showLockedReason(step: StepTabItem) {
    if (!step.lockedReason) return;
    setActiveTooltipStep(step.id);
    setAnnouncedMessage(`Cannot open ${step.label}: ${step.lockedReason}`);
    if (tooltipTimerRef.current) window.clearTimeout(tooltipTimerRef.current);
    tooltipTimerRef.current = window.setTimeout(() => {
      setActiveTooltipStep(null);
    }, 3500);
  }

  function handleTabClick(step: StepTabItem) {
    if (step.isLocked) {
      showLockedReason(step);
      return;
    }
    setActiveTooltipStep(null);
    onSelectStep(step.id);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let targetIndex = -1;
    if (event.key === 'ArrowRight') {
      targetIndex = (index + 1) % steps.length;
    } else if (event.key === 'ArrowLeft') {
      targetIndex = (index - 1 + steps.length) % steps.length;
    } else if (event.key === 'Home') {
      targetIndex = 0;
    } else if (event.key === 'End') {
      targetIndex = steps.length - 1;
    }

    if (targetIndex >= 0) {
      event.preventDefault();
      const targetStep = steps[targetIndex];
      const button = tabRefs.current.get(targetStep.id);
      button?.focus();
    }
  }

  return (
    <nav
      ref={navRef}
      className={`step-tabs-nav order-section-nav ${className}`.trim()}
      role="tablist"
      aria-label="Order sections"
    >
      <div className="step-tabs-track">
        {steps.map((step, index) => {
          const isCurrent = currentStep === step.id;
          const isLocked = step.isLocked;
          const showTooltip = activeTooltipStep === step.id && isLocked;
          const reasonId = `step-locked-reason-${step.id}`;

          return (
            <div key={step.id} className="step-tab-wrapper">
              <button
                ref={(el) => {
                  if (el) tabRefs.current.set(step.id, el);
                  else tabRefs.current.delete(step.id);
                }}
                type="button"
                role="tab"
                data-section={step.id}
                aria-selected={isCurrent}
                aria-current={isCurrent ? 'step' : undefined}
                aria-disabled={isLocked ? true : undefined}
                aria-describedby={isLocked ? reasonId : undefined}
                className={`step-tab order-section-tab ${isCurrent ? 'is-active' : ''} ${step.isDone && !isCurrent ? 'is-done' : ''} ${isLocked ? 'is-locked' : ''}`}
                onClick={() => handleTabClick(step)}
                onKeyDown={(e) => handleKeyDown(e, index)}
                onMouseEnter={() => {
                  if (isLocked) setActiveTooltipStep(step.id);
                }}
                onMouseLeave={() => {
                  if (isLocked && activeTooltipStep === step.id) setActiveTooltipStep(null);
                }}
                onFocus={() => {
                  if (isLocked) showLockedReason(step);
                }}
                onBlur={() => {
                  if (activeTooltipStep === step.id) setActiveTooltipStep(null);
                }}
              >
                {step.isDone && !isCurrent && (
                  <span className="step-tab-icon is-check" aria-hidden="true">
                    <Icon name="check" size={13} />
                  </span>
                )}
                {isLocked && (
                  <span className="step-tab-icon is-lock" aria-hidden="true">
                    <Icon name="lock" size={12} />
                  </span>
                )}
                <span className="step-tab-label">{step.label}</span>
                {step.badgeCount !== undefined && step.badgeCount > 0 && (
                  <span className="step-tab-badge" aria-label={`${step.badgeCount} items`}>
                    {step.badgeCount}
                  </span>
                )}
              </button>

              {/* Accessible locked step reason tooltip */}
              {isLocked && (
                <div
                  id={reasonId}
                  role="tooltip"
                  className={`step-locked-tooltip ${showTooltip ? 'is-visible' : ''}`}
                  aria-hidden={!showTooltip}
                >
                  <span className="step-locked-tooltip-text">{step.lockedReason}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Screen-reader announcement region for non-silent feedback on locked clicks */}
      <span className="sr-only" role="status" aria-live="polite">
        {announcedMessage}
      </span>
    </nav>
  );
});
