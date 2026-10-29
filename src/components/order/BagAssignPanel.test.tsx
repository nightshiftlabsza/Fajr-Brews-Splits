/** @vitest-environment jsdom */

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Bag, Person } from '../../types';
import { BagAssignPanel } from './BagAssignPanel';

const testPeople: Person[] = [
  { id: 'p-1', workspaceId: 'w-1', name: 'Alice', createdAt: '', updatedAt: '' },
  { id: 'p-2', workspaceId: 'w-1', name: 'Bilal', createdAt: '', updatedAt: '' },
  { id: 'p-3', workspaceId: 'w-1', name: 'Cara', createdAt: '', updatedAt: '' },
];

describe('BagAssignPanel', () => {
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

  it('renders people list and allows selecting a person', () => {
    const onSave = vi.fn();
    const onCancel = vi.fn();
    const bag: Bag = { id: 'b-1', splitMode: 'unassigned', buyers: [] };

    act(() => {
      root.render(
        <BagAssignPanel
          bag={bag}
          bagIndex={0}
          bagSize={250}
          people={testPeople}
          onSave={onSave}
          onCancel={onCancel}
        />
      );
    });

    expect(container.textContent).toContain('Alice');
    expect(container.textContent).toContain('Bilal');
    expect(container.textContent).toContain('Left to give: 250g');

    const doneBtn = Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.trim() === 'Done');
    expect(doneBtn?.disabled).toBe(true);

    // Click Alice row
    const aliceRow = Array.from(container.querySelectorAll('.fb-assign-person-row')).find((r) =>
      r.textContent?.includes('Alice')
    ) as HTMLElement;
    expect(aliceRow).toBeTruthy();

    act(() => {
      aliceRow.click();
    });

    expect(container.textContent).toContain('250g of 250g');
    expect(doneBtn?.disabled).toBe(false);

    act(() => {
      doneBtn?.click();
    });

    expect(onSave).toHaveBeenCalledWith([{ personId: 'p-1', grams: 250 }], 'full');
  });

  it('supports equal split across multiple people with floor division', () => {
    const onSave = vi.fn();
    const onCancel = vi.fn();
    const bag: Bag = {
      id: 'b-1',
      splitMode: 'equal',
      buyers: [
        { id: 'b-1', personId: 'p-1', grams: 83 },
        { id: 'b-2', personId: 'p-2', grams: 83 },
        { id: 'b-3', personId: 'p-3', grams: 84 },
      ],
    };

    act(() => {
      root.render(
        <BagAssignPanel
          bag={bag}
          bagIndex={0}
          bagSize={250}
          people={testPeople}
          onSave={onSave}
          onCancel={onCancel}
        />
      );
    });

    expect(container.textContent).toContain('83g');
    expect(container.textContent).toContain('84g');
    expect(container.textContent).toContain('250g of 250g');

    const doneBtn = Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.trim() === 'Done');
    expect(doneBtn?.disabled).toBe(false);

    act(() => {
      doneBtn?.click();
    });

    expect(onSave).toHaveBeenCalledWith(
      [
        { personId: 'p-1', grams: 83 },
        { personId: 'p-2', grams: 83 },
        { personId: 'p-3', grams: 84 },
      ],
      'equal'
    );
  });

  it('switches to custom amounts mode and validates live balance', () => {
    const onSave = vi.fn();
    const onCancel = vi.fn();
    const bag: Bag = {
      id: 'b-1',
      splitMode: 'equal',
      buyers: [
        { id: 'b-1', personId: 'p-1', grams: 125 },
        { id: 'b-2', personId: 'p-2', grams: 125 },
      ],
    };

    act(() => {
      root.render(
        <BagAssignPanel
          bag={bag}
          bagIndex={0}
          bagSize={250}
          people={testPeople}
          onSave={onSave}
          onCancel={onCancel}
        />
      );
    });

    const changeAmountsBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Change amounts')
    );
    expect(changeAmountsBtn).toBeTruthy();

    act(() => {
      changeAmountsBtn?.click();
    });

    // An input should appear for the custom amounts
    const inputs = container.querySelectorAll<HTMLInputElement>('input.fb-assign-gram-input');
    expect(inputs.length).toBe(2);

    // Over-allocate: set first input to 200 (200 + 125 = 325g > 250g)
    act(() => {
      const nativeSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      nativeSetter?.call(inputs[0], '200');
      inputs[0].dispatchEvent(new Event('input', { bubbles: true }));
      inputs[0].dispatchEvent(new Event('change', { bubbles: true }));
    });

    expect(container.textContent).toContain('Over by 75g');
    const doneBtn = Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.trim() === 'Done');
    expect(doneBtn?.disabled).toBe(true);

    // Set second input to 50 (200 + 50 = 250g)
    act(() => {
      const nativeSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      nativeSetter?.call(inputs[1], '50');
      inputs[1].dispatchEvent(new Event('input', { bubbles: true }));
      inputs[1].dispatchEvent(new Event('change', { bubbles: true }));
    });

    expect(container.textContent).toContain('250g of 250g');
    expect(doneBtn?.disabled).toBe(false);

    act(() => {
      doneBtn?.click();
    });

    expect(onSave).toHaveBeenCalledWith(
      [
        { personId: 'p-1', grams: 200 },
        { personId: 'p-2', grams: 50 },
      ],
      'custom'
    );
  });

  it('triggers cancel on Escape key', () => {
    const onCancel = vi.fn();
    const bag: Bag = { id: 'b-1', splitMode: 'unassigned', buyers: [] };

    act(() => {
      root.render(
        <BagAssignPanel
          bag={bag}
          bagIndex={0}
          bagSize={250}
          people={testPeople}
          onSave={vi.fn()}
          onCancel={onCancel}
        />
      );
    });

    const panel = container.querySelector('.fb-bag-assign-panel') as HTMLElement;
    act(() => {
      panel.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('shows search input when more than 6 people and filters list', () => {
    const manyPeople: Person[] = Array.from({ length: 12 }, (_, i) => ({
      id: `p-${i + 1}`,
      workspaceId: 'w-1',
      name: `Person ${i + 1}`,
      createdAt: '',
      updatedAt: '',
    }));

    act(() => {
      root.render(
        <BagAssignPanel
          bag={{ id: 'b-1', splitMode: 'unassigned', buyers: [] }}
          bagIndex={0}
          bagSize={250}
          people={manyPeople}
          onSave={vi.fn()}
          onCancel={vi.fn()}
        />
      );
    });

    const searchInput = container.querySelector('input[type="search"]') as HTMLInputElement;
    expect(searchInput).toBeTruthy();

    act(() => {
      const nativeSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      nativeSetter?.call(searchInput, 'Person 12');
      searchInput.dispatchEvent(new Event('input', { bubbles: true }));
      searchInput.dispatchEvent(new Event('change', { bubbles: true }));
    });

    expect(container.textContent).toContain('Person 12');
    expect(container.textContent).not.toContain('Person 2\n');
  });

  it('rounds decimal custom amount on blur and surfaces friendly notification', () => {
    const bag: Bag = {
      id: 'b-1',
      splitMode: 'custom',
      buyers: [
        { id: 'b-1', personId: 'p-1', grams: 125 },
        { id: 'b-2', personId: 'p-2', grams: 125 },
      ],
    };

    act(() => {
      root.render(
        <BagAssignPanel
          bag={bag}
          bagIndex={0}
          bagSize={250}
          people={testPeople}
          onSave={vi.fn()}
          onCancel={vi.fn()}
        />
      );
    });

    const inputs = container.querySelectorAll<HTMLInputElement>('input.fb-assign-gram-input');
    act(() => {
      const nativeSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      nativeSetter?.call(inputs[0], '124.6');
      inputs[0].dispatchEvent(new Event('input', { bubbles: true }));
      inputs[0].dispatchEvent(new Event('change', { bubbles: true }));
      inputs[0].dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    });

    expect(container.textContent).toContain('Amounts must be whole grams. Rounded to 125g.');
  });
});
