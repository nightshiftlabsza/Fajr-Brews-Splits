/** @vitest-environment jsdom */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SearchablePicker } from './SearchablePicker';

interface CurrencyItem {
  code: string;
  name: string;
  symbol: string;
}

const mockCurrencies: CurrencyItem[] = [
  { code: 'EUR', name: 'Euro', symbol: '€' },
  { code: 'USD', name: 'US Dollar', symbol: '$' },
  { code: 'GBP', name: 'British Pound', symbol: '£' },
  { code: 'AED', name: 'Emirati Dirham', symbol: 'د.إ' },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥' },
  { code: 'DKK', name: 'Danish Krone', symbol: 'kr.' },
];

describe('SearchablePicker', () => {
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

  it('matches items by name, currency code, or symbol', () => {
    const onSelect = vi.fn();

    act(() => {
      root.render(
        <SearchablePicker
          items={mockCurrencies}
          selectedId="USD"
          onSelect={onSelect}
          getId={(c) => c.code}
          getSearchFields={(c) => [c.code, c.name, c.symbol]}
          renderItem={(c) => (
            <div>
              <span>{c.code}</span> - <span>{c.name}</span> ({c.symbol})
            </div>
          )}
        />
      );
    });

    const searchInput = container.querySelector('input[type="search"]') as HTMLInputElement;

    // Search by symbol "£"
    act(() => {
      const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
      nativeSetter?.call(searchInput, '£');
      searchInput.dispatchEvent(new Event('input', { bubbles: true }));
      searchInput.dispatchEvent(new Event('change', { bubbles: true }));
    });

    let options = container.querySelectorAll('.fb-picker-option');
    expect(options).toHaveLength(1);
    expect(options[0].textContent).toContain('GBP');

    // Search by code "aed"
    act(() => {
      const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
      nativeSetter?.call(searchInput, 'aed');
      searchInput.dispatchEvent(new Event('input', { bubbles: true }));
      searchInput.dispatchEvent(new Event('change', { bubbles: true }));
    });

    options = container.querySelectorAll('.fb-picker-option');
    expect(options).toHaveLength(1);
    expect(options[0].textContent).toContain('Emirati Dirham');
  });

  it('separates items into Suggested and All groups', () => {
    act(() => {
      root.render(
        <SearchablePicker
          items={mockCurrencies}
          onSelect={() => {}}
          getId={(c) => c.code}
          getSearchFields={(c) => [c.code, c.name, c.symbol]}
          isSuggested={(c) => ['EUR', 'USD', 'GBP'].includes(c.code)}
          renderItem={(c) => <span>{c.code}</span>}
        />
      );
    });

    const groups = container.querySelectorAll('.fb-picker-group');
    expect(groups).toHaveLength(2);

    expect(groups[0].querySelector('.fb-picker-group-heading')?.textContent).toBe('Suggested');
    expect(groups[1].querySelector('.fb-picker-group-heading')?.textContent).toBe('All');

    const suggestedOptions = groups[0].querySelectorAll('.fb-picker-option');
    expect(suggestedOptions).toHaveLength(3); // EUR, USD, GBP
  });

  it('navigates with arrow keys and selects with Enter', () => {
    const onSelect = vi.fn();

    act(() => {
      root.render(
        <SearchablePicker
          items={mockCurrencies}
          onSelect={onSelect}
          getId={(c) => c.code}
          getSearchFields={(c) => [c.code, c.name, c.symbol]}
          renderItem={(c) => <span>{c.code}</span>}
        />
      );
    });

    const picker = container.querySelector('.fb-searchable-picker') as HTMLDivElement;

    // Arrow down moves highlight from index 0 to index 1
    act(() => {
      picker.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    });

    const options = container.querySelectorAll('.fb-picker-option');
    expect(options[1].classList.contains('is-highlighted')).toBe(true);

    // Press Enter to select highlighted
    act(() => {
      picker.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    });

    expect(onSelect).toHaveBeenCalledWith(mockCurrencies[1]);
  });
});
