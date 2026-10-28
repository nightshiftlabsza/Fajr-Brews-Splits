/** @vitest-environment jsdom */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Icon, type IconName } from './Icon';

describe('Icon', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  const iconNames: IconName[] = [
    'cup',
    'warning',
    'info',
    'gear',
    'chevron-down',
    'chevron-up',
    'check',
    'close',
    'plus',
    'minus',
    'lock',
    'copy',
    'duplicate',
    'archive',
    'trash',
    'search',
    'arrow-right',
    'dots',
    'user',
    'clock',
  ];

  it('renders all supported icons as SVGs with 1.5 stroke width', () => {
    for (const name of iconNames) {
      act(() => {
        root.render(<Icon name={name} />);
      });
      const svg = container.querySelector('svg');
      expect(svg).toBeTruthy();
      expect(svg?.getAttribute('stroke-width')).toBe('1.5');
      expect(svg?.getAttribute('aria-hidden')).toBe('true');
      expect(svg?.classList.contains(`fb-icon-${name}`)).toBe(true);
    }
  });

  it('exposes accessible label when provided', () => {
    act(() => {
      root.render(<Icon name="warning" aria-label="Warning message" />);
    });
    const svg = container.querySelector('svg');
    expect(svg?.getAttribute('aria-hidden')).toBeNull();
    expect(svg?.getAttribute('aria-label')).toBe('Warning message');
    expect(svg?.getAttribute('role')).toBe('img');
  });

  it('allows custom size and class name', () => {
    act(() => {
      root.render(<Icon name="cup" size={24} className="custom-icon" />);
    });
    const svg = container.querySelector('svg');
    expect(svg?.getAttribute('width')).toBe('24');
    expect(svg?.getAttribute('height')).toBe('24');
    expect(svg?.classList.contains('custom-icon')).toBe(true);
  });
});
