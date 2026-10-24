import { useEffect, useState } from 'react';
import { useAppStore } from '../../store/appStore';
import type { Theme, ThemeMode, WorkspaceMember } from '../../types';
import { formatDateShort, todayISO } from '../../lib/formatters';
import { ConfirmModal } from '../ui/ConfirmModal';
import { PeoplePage } from './PeoplePage';

const THEMES: { id: Theme; name: string; description: string }[] = [
  { id: 'emerald', name: 'Emerald Ledger', description: 'Warm mineral · Deep emerald · Serif headings' },
  { id: 'yinmn', name: 'YInMn Ledger', description: 'Cool mineral · YInMn blue · Geometric headings' },
];

const MODES: { id: ThemeMode; label: string; icon: string }[] = [
  { id: 'light', label: 'Light', icon: '☀️' },
  { id: 'dark',  label: 'Dark',  icon: '🌙' },
  { id: 'auto',  label: 'Auto',  icon: '🖥' },
];

type SettingsTab = 'general' | 'members' | 'backup' | 'people';

export function SettingsPage() {
  const {
    user, memberRole, accessStatus, settings, setTheme, setThemeMode, signOut,
    workspaceMembers, fetchWorkspaceMembers, addMemberByEmail, removeMember,
    exportJSON, importJSON, setLastExportDate,
  } = useAppStore();

  const [activeTab, setActiveTab] = useState<SettingsTab>('general');
  const [membersLoaded, setMembersLoaded] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'member'>('member');
  const [inviteError, setInviteError] = useState('');
  const [inviteSuccess, setInviteSuccess] = useState('');
  const [inviting, setInviting] = useState(false);
  const [removeError, setRemoveError] = useState('');
  const [removeTarget, setRemoveTarget] = useState<WorkspaceMember | null>(null);
  const [removing, setRemoving] = useState(false);
  const [importStatus, setImportStatus] = useState<{ text: string; tone: 'success' | 'error' } | null>(null);

  const isAdmin = memberRole === 'owner' || memberRole === 'admin';
  const roleLabel = accessStatus === 'participant' ? 'participant' : memberRole ?? 'member';

  async function loadMembers() {
    await fetchWorkspaceMembers();
    setMembersLoaded(true);
  }

  useEffect(() => {
    if (activeTab === 'members' && !membersLoaded && isAdmin) {
      void loadMembers();
    }
  }, [activeTab, membersLoaded, isAdmin]);

  async function handleInvite() {
    if (!inviteEmail.trim()) return setInviteError('Email is required.');
    setInviteError('');
    setInviteSuccess('');
    setInviting(true);
    try {
      const err = await addMemberByEmail(inviteEmail.trim(), inviteRole);
      if (err) {
        setInviteError(err);
      } else {
        setInviteSuccess(`${inviteEmail} added to workspace.`);
        setInviteEmail('');
      }
    } finally {
      setInviting(false);
    }
  }

  async function confirmRemoveMember() {
    if (!removeTarget) return;
    setRemoving(true);
    setRemoveError('');
    try {
      await removeMember(removeTarget.userId);
      setRemoveTarget(null);
    } catch (e) {
      setRemoveError(String(e));
    } finally {
      setRemoving(false);
    }
  }

  function handleExport() {
    const json = exportJSON();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `fajr-brews-backup-${todayISO()}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    setLastExportDate(new Date().toISOString());
  }

  async function handleImport() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.onchange = async (event) => {
      const file = (event.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const text = await file.text();
      try {
        await importJSON(text);
        setImportStatus({ text: 'Import completed successfully.', tone: 'success' });
        setTimeout(() => setImportStatus(null), 4000);
      } catch {
        setImportStatus({ text: 'Failed to import — the JSON file format was invalid.', tone: 'error' });
        setTimeout(() => setImportStatus(null), 5000);
      }
    };
    input.click();
  }

  return (
    <div className="page-container">
      <div style={{ marginBottom: 'var(--space-5)' }}>
        <h2 style={{ marginBottom: 4 }}>Settings</h2>
        <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
          Personal preferences, people directory, and workspace management.
        </p>
      </div>

      {/* Sub-tab navigation */}
      <div className="settings-tab-bar" role="tablist" aria-label="Settings navigation">
        <button
          type="button"
          className={`settings-tab-btn ${activeTab === 'general' ? 'is-active' : ''}`}
          onClick={() => setActiveTab('general')}
          role="tab"
          aria-selected={activeTab === 'general'}
        >
          General Preferences
        </button>
        {isAdmin && (
          <button
            type="button"
            className={`settings-tab-btn ${activeTab === 'members' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('members')}
            role="tab"
            aria-selected={activeTab === 'members'}
          >
            Workspace Members
          </button>
        )}
        <button
          type="button"
          className={`settings-tab-btn ${activeTab === 'backup' ? 'is-active' : ''}`}
          onClick={() => setActiveTab('backup')}
          role="tab"
          aria-selected={activeTab === 'backup'}
        >
          Backup & Restore
        </button>
        <button
          type="button"
          className={`settings-tab-btn ${activeTab === 'people' ? 'is-active' : ''}`}
          onClick={() => setActiveTab('people')}
          role="tab"
          aria-selected={activeTab === 'people'}
        >
          People Directory
        </button>
      </div>

      {activeTab === 'people' && (
        <PeoplePage embedded={true} />
      )}

      {activeTab === 'general' && (
        <>
          {/* Account */}
          <Section title="Account">
            <div className="settings-account-row">
              <div>
                <div style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{user?.email}</div>
                <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', marginTop: 2, textTransform: 'capitalize' }}>
                  Workspace role: {roleLabel}
                </div>
              </div>
              <button className="btn btn-secondary btn-sm" onClick={signOut}>Sign out</button>
            </div>
          </Section>

          {/* Theme */}
          <Section title="Theme">
            <div className="settings-theme-group">
              {THEMES.map((theme) => (
                <label
                  key={theme.id}
                  className={`settings-theme-option ${settings.theme === theme.id ? 'is-selected' : ''}`}
                  style={settings.theme === theme.id ? { outline: '2px solid var(--color-primary)', outlineOffset: '2px' } : {}}
                >
                  <input
                    type="radio"
                    name="theme"
                    value={theme.id}
                    checked={settings.theme === theme.id}
                    onChange={() => setTheme(theme.id)}
                  />
                  <ThemeSwatch themeId={theme.id} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{theme.name}</div>
                    <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>{theme.description}</div>
                  </div>
                </label>
              ))}
            </div>

            {/* Mode */}
            <div className="settings-mode-group">
              {MODES.map((mode) => (
                <button
                  key={mode.id}
                  className={`btn btn-sm ${settings.themeMode === mode.id ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ flex: 1 }}
                  onClick={() => setThemeMode(mode.id)}
                >
                  {mode.icon} {mode.label}
                </button>
              ))}
            </div>
          </Section>

          {/* Sync Status */}
          <Section title="Sync Status">
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
              <div className="realtime-dot" />
              <span style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>
                Realtime sync active — changes appear instantly for all workspace members.
              </span>
            </div>
          </Section>
        </>
      )}

      {activeTab === 'members' && isAdmin && (
        <Section title="Workspace Members" action={
          !membersLoaded ? (
            <button className="btn btn-ghost btn-sm" onClick={loadMembers}>Load members</button>
          ) : undefined
        }>
          {!membersLoaded ? (
            <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
              Click above to view and manage workspace members.
            </p>
          ) : (
            <>
              {/* Invite */}
              <div className="settings-invite-form">
                <input
                  className="input"
                  type="email"
                  placeholder="Invite by email…"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  style={{ flex: 1, minWidth: 200 }}
                />
                <select
                  className="input"
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as 'admin' | 'member')}
                  style={{ width: 'auto' }}
                >
                  <option value="member">Member</option>
                  <option value="admin">Admin</option>
                </select>
                <button className="btn btn-primary" onClick={handleInvite} disabled={inviting}>
                  {inviting ? <span className="spinner" style={{ width: 14, height: 14 }} /> : 'Invite'}
                </button>
              </div>

              {inviteError && <div className="alert alert-error" style={{ marginBottom: 'var(--space-3)' }}>{inviteError}</div>}
              {inviteSuccess && <div className="alert alert-success" style={{ marginBottom: 'var(--space-3)' }}>{inviteSuccess}</div>}
              {removeError && <div className="alert alert-error" style={{ marginBottom: 'var(--space-3)' }}>{removeError}</div>}

              {/* Members list */}
              {workspaceMembers.length === 0 ? (
                <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>No members found.</p>
              ) : (
                <div className="data-table-container">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Member</th>
                        <th>Role</th>
                        <th>Joined</th>
                        <th style={{ textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {workspaceMembers.map((member) => (
                        <tr key={member.id}>
                          <td>
                            <div style={{ fontWeight: 600 }}>{member.fullName || member.email || member.userId}</div>
                            {member.fullName && member.email && (
                              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{member.email}</div>
                            )}
                          </td>
                          <td>
                            <span className={`wizard-badge ${member.role === 'owner' ? 'wizard-badge-accent' : member.role === 'admin' ? 'wizard-badge-info' : 'wizard-badge-muted'}`} style={{ textTransform: 'capitalize' }}>
                              {member.role}
                            </span>
                          </td>
                          <td style={{ color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' }}>
                            {formatDateShort(member.createdAt.split('T')[0])}
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            {member.userId !== user?.id && (
                              <button
                                className="btn btn-ghost btn-sm"
                                style={{ color: 'var(--color-unpaid)' }}
                                onClick={() => setRemoveTarget(member)}
                              >
                                Remove
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </Section>
      )}

      {activeTab === 'backup' && (
        <Section title="Data Backup & Restore">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', margin: 0 }}>
              Export a complete snapshot of your workspace (orders, coffee lots, allocations, participants, roasters) as JSON, or restore from a previously exported backup file.
            </p>

            {settings.lastExportDate && (
              <div className="alert alert-info" style={{ fontSize: '0.8125rem' }}>
                Last backup exported: {formatDateShort(settings.lastExportDate.split('T')[0])}
              </div>
            )}

            {importStatus && (
              <div className={`alert ${importStatus.tone === 'success' ? 'alert-success' : 'alert-error'}`}>
                {importStatus.text}
              </div>
            )}

            <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
              <button className="btn btn-primary" onClick={handleExport}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
                Export JSON Backup
              </button>

              <button className="btn btn-secondary" onClick={() => void handleImport()}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>
                Import JSON File
              </button>
            </div>
          </div>
        </Section>
      )}

      {/* Remove Member Confirm Modal */}
      {removeTarget && (
        <ConfirmModal
          isOpen={true}
          title={`Remove "${removeTarget.email || removeTarget.fullName || 'Member'}"?`}
          description="Are you sure you want to remove this member from the workspace? They will lose access to all orders and data."
          confirmText="Remove Member"
          cancelText="Cancel"
          variant="danger"
          isLoading={removing}
          onConfirm={confirmRemoveMember}
          onCancel={() => setRemoveTarget(null)}
        />
      )}
    </div>
  );
}

// ─── Section wrapper ──────────────────────────────────────────

function Section({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="card card-padded" style={{ marginBottom: 'var(--space-4)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-4)' }}>
        <div className="section-label" style={{ marginBottom: 0 }}>{title}</div>
        {action}
      </div>
      {children}
    </div>
  );
}

// ─── Theme swatch ─────────────────────────────────────────────

function ThemeSwatch({ themeId }: { themeId: Theme }) {
  const palettes: Record<Theme, { bg: string; accent: string }> = {
    emerald: { bg: '#F4F7F2', accent: '#1B5E40' },
    yinmn:   { bg: '#EEF0F7', accent: '#2E4DAA' },
  };
  const p = palettes[themeId];
  return (
    <div style={{
      width: 36, height: 24, borderRadius: 5, overflow: 'hidden',
      border: '1px solid var(--color-border)', flexShrink: 0,
      background: p.bg, position: 'relative',
    }}>
      <div style={{
        position: 'absolute', right: 0, top: 0, bottom: 0,
        width: '35%', background: p.accent,
      }} />
    </div>
  );
}
