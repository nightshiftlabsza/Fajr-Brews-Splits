import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

async function loadStore(session: { user?: { id: string; email?: string | null; user_metadata?: { full_name?: string } } } | null) {
  const getSession = vi.fn().mockResolvedValue({ data: { session } });

  vi.doMock('../lib/supabase', () => ({
    WORKSPACE_ID: 'workspace-1',
    supabase: {
      auth: {
        getSession,
      },
    },
  }));

  const { useAppStore } = await import('./appStore');
  return { useAppStore, getSession };
}

describe('appStore.initialize', () => {
  it('does not trigger the blocking loader during silent reinitialization', async () => {
    const { useAppStore } = await loadStore(null);

    useAppStore.setState({ isInitialized: true, isLoading: false });

    const initializePromise = useAppStore.getState().initialize({ silent: true });
    expect(useAppStore.getState().isLoading).toBe(false);

    await initializePromise;

    expect(useAppStore.getState().isInitialized).toBe(true);
    expect(useAppStore.getState().isLoading).toBe(false);
  });

  it('still shows the blocking loader during the first initialize pass', async () => {
    const { useAppStore } = await loadStore(null);

    useAppStore.setState({ isInitialized: false, isLoading: false });

    const initializePromise = useAppStore.getState().initialize();
    expect(useAppStore.getState().isLoading).toBe(true);

    await initializePromise;

    expect(useAppStore.getState().isInitialized).toBe(true);
    expect(useAppStore.getState().isLoading).toBe(false);
  });
});
