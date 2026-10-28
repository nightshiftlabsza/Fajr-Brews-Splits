/** @vitest-environment jsdom */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PersonPickerList } from './PersonPickerList';
import { Sheet } from '../ui/Sheet';
import type { Person } from '../../types';

const mockPeople: Person[] = [
  { id: 'p1', workspaceId: 'ws-1', name: 'Zak', note: 'Loves Gesha', createdAt: '', updatedAt: '' },
  { id: 'p2', workspaceId: 'ws-1', name: 'Imraan Mohamed-Abrahams', email: 'imraan@example.com', createdAt: '', updatedAt: '' },
  { id: 'p3', workspaceId: 'ws-1', name: 'Zaid', note: 'Decaf only', createdAt: '', updatedAt: '' },
  { id: 'p4', workspaceId: 'ws-1', name: 'Ameen', createdAt: '', updatedAt: '' },
];

describe('PersonPickerList', () => {
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

  it('renders people list and filters dynamically by search query', () => {
    const onTogglePerson = vi.fn();

    act(() => {
      root.render(
        <PersonPickerList
          people={mockPeople}
          selectedPersonIds={['p1']}
          onTogglePerson={onTogglePerson}
        />
      );
    });

    const rows = container.querySelectorAll('.fb-person-picker-row');
    expect(rows).toHaveLength(4);

    // Initial check state
    const firstCheckbox = container.querySelector('#person-check-p1') as HTMLInputElement;
    expect(firstCheckbox.checked).toBe(true);

    // Search for "Imraan"
    const searchInput = container.querySelector('input[type="search"]') as HTMLInputElement;
    act(() => {
      const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
      nativeSetter?.call(searchInput, 'Imraan');
      searchInput.dispatchEvent(new Event('input', { bubbles: true }));
      searchInput.dispatchEvent(new Event('change', { bubbles: true }));
    });

    const filteredRows = container.querySelectorAll('.fb-person-picker-row');
    expect(filteredRows).toHaveLength(1);
    expect(filteredRows[0].textContent).toContain('Imraan Mohamed-Abrahams');
  });

  it('toggles selection when clicked or via keyboard Space/Enter', () => {
    const onTogglePerson = vi.fn();

    act(() => {
      root.render(
        <PersonPickerList
          people={mockPeople}
          selectedPersonIds={[]}
          onTogglePerson={onTogglePerson}
        />
      );
    });

    const row = container.querySelector('.fb-person-picker-row') as HTMLLabelElement;
    act(() => {
      row.click();
    });

    expect(onTogglePerson).toHaveBeenCalledWith('p1');

    act(() => {
      row.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
    });

    expect(onTogglePerson).toHaveBeenCalledTimes(2);
  });

  it('renders demo state wrapped in Sheet component without errors', () => {
    function DemoPickerWrapper() {
      return (
        <Sheet
          isOpen={true}
          onClose={() => {}}
          title="Assign Bag Buyers"
          footer={<button className="btn btn-primary">Done</button>}
        >
          <PersonPickerList
            people={mockPeople}
            selectedPersonIds={['p1', 'p2']}
            onTogglePerson={() => {}}
          />
        </Sheet>
      );
    }

    act(() => {
      root.render(<DemoPickerWrapper />);
    });

    expect(container.querySelector('[role="dialog"]')).toBeTruthy();
    expect(container.textContent).toContain('Assign Bag Buyers');
    expect(container.textContent).toContain('2 of 4 selected');
  });
});
