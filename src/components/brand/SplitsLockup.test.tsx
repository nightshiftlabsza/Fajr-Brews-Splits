/** @vitest-environment jsdom */

import { beforeEach, describe, expect, it } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { SplitsMark } from './SplitsMark';
import { SplitsLockup } from './SplitsLockup';

describe('SplitsMark and SplitsLockup', () => {
  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  });

  it('renders SVG mark with default 32px size and two half vessel paths', () => {
    const container = document.createElement('div');
    const root = createRoot(container);
    act(() => {
      root.render(<SplitsMark />);
    });

    const svg = container.querySelector('svg');
    expect(svg).toBeTruthy();
    expect(svg?.getAttribute('viewBox')).toBe('0 0 32 32');
    expect(svg?.getAttribute('width')).toBe('32');
    expect(svg?.getAttribute('height')).toBe('32');
    expect(svg?.getAttribute('aria-hidden')).toBe('true');

    const paths = container.querySelectorAll('path');
    expect(paths).toHaveLength(2);
    // Left half
    expect(paths[0].getAttribute('d')).toBe('M15 3.1C8.4 3.6 3.5 9.2 3.5 16S8.4 28.4 15 28.9V3.1Z');
    expect(paths[0].getAttribute('fill')).toBe('currentColor');
    // Right half
    expect(paths[1].getAttribute('d')).toBe('M17 3.1v25.8c6.6-.5 11.5-6.1 11.5-12.9S23.6 3.6 17 3.1Z');
    expect(paths[1].getAttribute('fill')).toBe('currentColor');
    expect(paths[1].getAttribute('fill-opacity')).toBe('0.42');
  });

  it('renders one-colour print variant when requested', () => {
    const container = document.createElement('div');
    const root = createRoot(container);
    act(() => {
      root.render(<SplitsMark variant="print" />);
    });

    const paths = container.querySelectorAll('path');
    expect(paths[0].getAttribute('fill')).toBe('#000000');
    expect(paths[1].getAttribute('fill')).toBe('none');
    expect(paths[1].getAttribute('stroke')).toBe('#000000');
    expect(paths[1].getAttribute('stroke-width')).toBe('1.6');
  });

  it('renders lockup with mark, brand name Splits., and attribution', () => {
    const container = document.createElement('div');
    const root = createRoot(container);
    act(() => {
      root.render(<SplitsLockup />);
    });

    const brandName = container.querySelector('.splits-brand-name');
    expect(brandName?.textContent).toBe('Splits.');
    const dot = container.querySelector('.splits-dot');
    expect(dot?.textContent).toBe('.');

    const attribution = container.querySelector('.splits-attribution');
    expect(attribution?.textContent).toBe('by Fajr Brews');
    const org = container.querySelector('.splits-attribution-org');
    expect(org?.textContent).toBe('Fajr Brews');
  });

  it('hides attribution when showAttribution is false', () => {
    const container = document.createElement('div');
    const root = createRoot(container);
    act(() => {
      root.render(<SplitsLockup showAttribution={false} />);
    });

    expect(container.querySelector('.splits-brand-name')?.textContent).toBe('Splits.');
    expect(container.querySelector('.splits-attribution')).toBeNull();
  });

  it('renders large lockup with 48px mark and large class', () => {
    const container = document.createElement('div');
    const root = createRoot(container);
    act(() => {
      root.render(<SplitsLockup size="large" />);
    });

    expect(container.querySelector('.splits-lockup--large')).toBeTruthy();
    const svg = container.querySelector('svg');
    expect(svg?.getAttribute('width')).toBe('48');
    expect(svg?.getAttribute('height')).toBe('48');
  });
});
