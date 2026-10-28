/** @vitest-environment jsdom */

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RoasterCurrencyField } from './RoasterCurrencyField';

describe('RoasterCurrencyField', () => {
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

  it('renders trigger with selected currency name, code, symbol, and help line', () => {
    act(() => {
      root.render(<RoasterCurrencyField value="EUR" onChange={vi.fn()} />);
    });

    const trigger = container.querySelector('.roaster-currency-trigger');
    expect(trigger).toBeTruthy();
    expect(trigger?.textContent).toContain('Euro (EUR)');
    expect(trigger?.textContent).toContain('€');

    const help = container.querySelector('.roaster-currency-help');
    expect(help?.textContent).toContain(
      "This only labels the roaster's prices. It does not change any amounts."
    );
  });

  it('renders fallback placeholder when no value is provided', () => {
    act(() => {
      root.render(<RoasterCurrencyField value={null} onChange={vi.fn()} />);
    });

    const trigger = container.querySelector('.roaster-currency-trigger');
    expect(trigger?.textContent).toContain('Choose currency...');
  });

  it('opens picker on click and shows Suggested group in order: Euro, Pound, US dollar, South African rand', () => {
    act(() => {
      root.render(<RoasterCurrencyField value="EUR" onChange={vi.fn()} />);
    });

    const trigger = container.querySelector('.roaster-currency-trigger') as HTMLButtonElement;
    act(() => {
      trigger.click();
    });

    const popover = container.querySelector('.roaster-currency-popover');
    expect(popover).toBeTruthy();

    const groupTitles = container.querySelectorAll('.fb-picker-group-heading');
    expect(groupTitles[0]?.textContent).toBe('Suggested');

    const options = Array.from(container.querySelectorAll('.fb-picker-option'));
    // The first 4 should be EUR, GBP, USD, ZAR
    expect(options[0]?.textContent).toContain('Euro');
    expect(options[0]?.textContent).toContain('EUR');
    expect(options[1]?.textContent).toContain('Pound sterling');
    expect(options[1]?.textContent).toContain('GBP');
    expect(options[2]?.textContent).toContain('US dollar');
    expect(options[2]?.textContent).toContain('USD');
    expect(options[3]?.textContent).toContain('South African rand');
    expect(options[3]?.textContent).toContain('ZAR');
  });

  it('searches and filters by country name (e.g. "south africa")', () => {
    act(() => {
      root.render(<RoasterCurrencyField value="EUR" onChange={vi.fn()} />);
    });

    const trigger = container.querySelector('.roaster-currency-trigger') as HTMLButtonElement;
    act(() => {
      trigger.click();
    });

    const searchInput = container.querySelector('.fb-picker-input') as HTMLInputElement;
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
      setter?.call(searchInput, 'south africa');
      searchInput.dispatchEvent(new Event('input', { bubbles: true }));
      searchInput.dispatchEvent(new Event('change', { bubbles: true }));
    });

    const visibleOptions = Array.from(container.querySelectorAll('.fb-picker-option'));
    expect(visibleOptions.length).toBe(1);
    expect(visibleOptions[0].textContent).toContain('South African rand');
    expect(visibleOptions[0].textContent).toContain('ZAR');
  });

  it('searches and filters by currency symbol (e.g. "£")', () => {
    act(() => {
      root.render(<RoasterCurrencyField value="EUR" onChange={vi.fn()} />);
    });

    const trigger = container.querySelector('.roaster-currency-trigger') as HTMLButtonElement;
    act(() => {
      trigger.click();
    });

    const searchInput = container.querySelector('.fb-picker-input') as HTMLInputElement;
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
      setter?.call(searchInput, '£');
      searchInput.dispatchEvent(new Event('input', { bubbles: true }));
      searchInput.dispatchEvent(new Event('change', { bubbles: true }));
    });

    const visibleOptions = Array.from(container.querySelectorAll('.fb-picker-option'));
    expect(visibleOptions.some((opt) => opt.textContent?.includes('Pound sterling'))).toBe(true);
  });

  it('searches and filters by currency code (e.g. "JPY")', () => {
    act(() => {
      root.render(<RoasterCurrencyField value="EUR" onChange={vi.fn()} />);
    });

    const trigger = container.querySelector('.roaster-currency-trigger') as HTMLButtonElement;
    act(() => {
      trigger.click();
    });

    const searchInput = container.querySelector('.fb-picker-input') as HTMLInputElement;
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
      setter?.call(searchInput, 'JPY');
      searchInput.dispatchEvent(new Event('input', { bubbles: true }));
      searchInput.dispatchEvent(new Event('change', { bubbles: true }));
    });

    const visibleOptions = Array.from(container.querySelectorAll('.fb-picker-option'));
    expect(visibleOptions.length).toBe(1);
    expect(visibleOptions[0].textContent).toContain('Japanese yen');
    expect(visibleOptions[0].textContent).toContain('JPY');
  });

  it('calls onChange with selected currency code and closes picker', () => {
    const handleChange = vi.fn();
    act(() => {
      root.render(<RoasterCurrencyField value="EUR" onChange={handleChange} />);
    });

    const trigger = container.querySelector('.roaster-currency-trigger') as HTMLButtonElement;
    act(() => {
      trigger.click();
    });

    // Select South African rand
    const zarOption = Array.from(container.querySelectorAll('.fb-picker-option')).find((opt) =>
      opt.textContent?.includes('South African rand')
    ) as HTMLElement;

    act(() => {
      zarOption.click();
    });

    expect(handleChange).toHaveBeenCalledWith('ZAR');
    expect(container.querySelector('.roaster-currency-popover')).toBeNull();
  });

  it('closes on Escape key press in picker', () => {
    act(() => {
      root.render(<RoasterCurrencyField value="EUR" onChange={vi.fn()} />);
    });

    const trigger = container.querySelector('.roaster-currency-trigger') as HTMLButtonElement;
    act(() => {
      trigger.click();
    });

    expect(container.querySelector('.roaster-currency-popover')).toBeTruthy();

    const searchInput = container.querySelector('.fb-picker-input') as HTMLInputElement;
    act(() => {
      searchInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });

    expect(container.querySelector('.roaster-currency-popover')).toBeNull();
  });
});
