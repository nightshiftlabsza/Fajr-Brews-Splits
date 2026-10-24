/** @vitest-environment jsdom */

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { WorkspaceMember } from '../../types';

const mockStoreState = {
  user: { id: 'user-1', email: 'owner@example.com' },
  memberRole: 'owner',
  accessStatus: 'member',
  settings: {
    theme: 'emerald',
    themeMode: 'light',
    lastExportDate: '2026-03-20T10:00:00.000Z',
  },
  setTheme: vi.fn(),
  setThemeMode: vi.fn(),
  signOut: vi.fn(),
  workspaceMembers: [
    {
      id: 'wm-1',
      workspaceId: 'ws-1',
      userId: 'user-1',
      role: 'owner',
      fullName: 'Owner User',
      email: 'owner@example.com',
      createdAt: '2026-03-01T00:00:00.000Z',
    },
    {
      id: 'wm-2',
      workspaceId: 'ws-1',
      userId: 'user-2',
      role: 'member',
      fullName: 'Regular Member',
      email: 'member@example.com',
      createdAt: '2026-03-05T00:00:00.000Z',
    },
  ] as WorkspaceMember[],
  fetchWorkspaceMembers: vi.fn().mockResolvedValue(undefined),
  addMemberByEmail: vi.fn().mockResolvedValue(null),
  removeMember: vi.fn().mockResolvedValue(undefined),
  exportJSON: vi.fn().mockReturnValue('{"test": true}'),
  importJSON: vi.fn().mockResolvedValue(undefined),
  setLastExportDate: vi.fn(),
  people: [],
  orders: [],
  linkedPersonId: null,
};

vi.mock('../../store/appStore', () => ({
  useAppStore: () => mockStoreState,
}));

import { SettingsPage } from './SettingsPage';

describe('SettingsPage sub-tabs and management', () => {
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
    vi.clearAllMocks();
  });

  it('renders General Preferences sub-tab by default', () => {
    act(() => {
      root.render(<SettingsPage />);
    });

    expect(container.textContent).toContain('General Preferences');
    expect(container.textContent).toContain('Workspace Members');
    expect(container.textContent).toContain('Backup & Restore');
    expect(container.textContent).toContain('People Directory');
    expect(container.textContent).toContain('owner@example.com');
    expect(container.textContent).toContain('Emerald Ledger');
    expect(container.textContent).toContain('YInMn Ledger');
  });

  it('switches to Workspace Members sub-tab and displays member table', async () => {
    act(() => {
      root.render(<SettingsPage />);
    });

    const membersTabBtn = Array.from(container.querySelectorAll('button')).find(
      (btn) => btn.textContent === 'Workspace Members',
    );
    expect(membersTabBtn).toBeTruthy();

    await act(async () => {
      membersTabBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });

    expect(mockStoreState.fetchWorkspaceMembers).toHaveBeenCalled();
    expect(container.querySelector('.data-table')).toBeTruthy();
    expect(container.textContent).toContain('Regular Member');
    expect(container.textContent).toContain('member@example.com');
  });

  it('switches to Backup & Restore sub-tab and triggers JSON export', async () => {
    act(() => {
      root.render(<SettingsPage />);
    });

    const backupTabBtn = Array.from(container.querySelectorAll('button')).find(
      (btn) => btn.textContent === 'Backup & Restore',
    );
    expect(backupTabBtn).toBeTruthy();

    await act(async () => {
      backupTabBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });

    expect(container.textContent).toContain('Data Backup & Restore');
    expect(container.textContent).toContain('Export JSON Backup');
    expect(container.textContent).toContain('Import JSON File');

    const exportBtn = Array.from(container.querySelectorAll('button')).find(
      (btn) => btn.textContent?.includes('Export JSON Backup'),
    );

    // Mock URL.createObjectURL and URL.revokeObjectURL
    const originalCreateObjectURL = URL.createObjectURL;
    const originalRevokeObjectURL = URL.revokeObjectURL;
    const originalClick = HTMLAnchorElement.prototype.click;
    URL.createObjectURL = vi.fn().mockReturnValue('blob:test');
    URL.revokeObjectURL = vi.fn();
    HTMLAnchorElement.prototype.click = vi.fn();

    await act(async () => {
      exportBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });

    expect(mockStoreState.exportJSON).toHaveBeenCalled();
    expect(mockStoreState.setLastExportDate).toHaveBeenCalled();

    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
    HTMLAnchorElement.prototype.click = originalClick;
  });

  it('allows changing theme and theme mode', async () => {
    act(() => {
      root.render(<SettingsPage />);
    });

    const yinmnInput = container.querySelector('input[value="yinmn"]');
    expect(yinmnInput).toBeTruthy();

    await act(async () => {
      yinmnInput?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });

    expect(mockStoreState.setTheme).toHaveBeenCalledWith('yinmn');

    const darkBtn = Array.from(container.querySelectorAll('button')).find(
      (btn) => btn.textContent?.includes('Dark'),
    );
    expect(darkBtn).toBeTruthy();

    await act(async () => {
      darkBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });

    expect(mockStoreState.setThemeMode).toHaveBeenCalledWith('dark');
  });
});
