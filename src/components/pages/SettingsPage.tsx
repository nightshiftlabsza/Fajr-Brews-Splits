import { useState } from 'react';
import { useAppStore } from '../../store/appStore';
import type { Theme, ThemeMode, WorkspaceMember } from '../../types';
import { formatDateShort } from '../../lib/formatters';

const THEMES: { id: Theme; name: string; description: string }[] = [
  { id: 'emerald', name: 'Emerald Ledger', description: 'Warm mineral · Deep emerald · Serif headings' },
  { id: 'yinmn', name: 'YInMn Ledger', description: 'Cool mineral · YInMn blue · Geometric headings' },
];

const MODES: { id: ThemeMode; label: string; icon: string }[] = [
  { id: 'light', label: 'Light', icon: '☀️' },
  { id: 'dark',  label: 'Dark',  icon: '🌙' },
  { id: 'auto',  label: 'Auto',  icon: '🖥' },
];

export function SettingsPage() {
  const {
    user, memberRole, accessStatus, settings, setTheme, setThemeMode, signOut,
    workspaceMembers, fetchWorkspaceMembers, addMemberByEmail, removeMember,
  } = useAppStore();

  const [membersLoaded, setMembersLoaded] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'member'>('member');
  const [inviteError, setInviteError] = useState('');
  const [inviteSuccess, setInviteSuccess] = useState('');
  const [inviting, setInviting] = useState(false);
  const [removeError, setRemoveError] = useState('');

  const isAdmin = memberRole === 'owner' || memberRole === 'admin';
  const roleLabel = accessStatus === 'participant' ? 'participant' : memberRole ?? 'member';

  async function loadMembers() {
    await fetchWorkspaceMembers();
    setMembersLoaded(true);
  }

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

  async function handleRemove(member: WorkspaceMember) {
    if (!confirm(`Remove ${member.email || member.fullName || 'this member'} from the workspace?`)) return;
    setRemoveError('');
    try {
      await removeMember(member.userId);
    } catch (e) {
      setRemoveError(String(e));
    }
  }

  return (
    <div className="page-container">
      <div style={{ marginBottom: 'var(--space-6)' }}>
        <h2 style={{ marginBottom: 4 }}>Settings</h2>
        <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
          Personal preferences and workspace management.
        </p>
      </div>

      {/* Account */}
      <Section title="Account">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', marginBottom: 'var(--space-5)' }}>
          {THEMES.map((theme) => (
            <label key={theme.id} style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-4)',
              padding: 'var(--space-4)',
              border: `1.5px solid ${settings.theme === theme.id ? 'var(--color-accent)' : 'var(--color-border)'}`,
              borderRadius: 'var(--radius-sm)',
              cursor: 'pointer',
              background: settings.theme === theme.id ? 'var(--color-accent-light)' : 'transparent',
              transition: 'border-color var(--transition-fast), background var(--transition-fast)',
            }}>
              <input
                type="radio"
                name="theme"
                value={theme.id}
                checked={settings.theme === theme.id}
                onChange={() => setTheme(theme.id)}
                style={{ accentColor: 'var(--color-accent)' }}
              />
              <ThemeSwatch themeId={theme.id} />
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.9375rem', color: 'var(--color-text-primary)' }}>{theme.name}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 2 }}>{theme.description}</div>
              </div>
            </label>
          ))}
        </div>

        <div className="section-label">Mode</div>
        <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
          {MODES.map((m) => (
            <button
              key={m.id}
              onClick={() => setThemeMode(m.id)}
              style={{
                flex: '1 1 auto',
                minWidth: 80,
                padding: 'var(--space-3) var(--space-4)',
                border: `1.5px solid ${settings.themeMode === m.id ? 'var(--color-accent)' : 'var(--color-border)'}`,
                borderRadius: 'var(--radius-sm)',
                background: settings.themeMode === m.id ? 'var(--color-accent-light)' : 'var(--color-surface-raised)',
                color: settings.themeMode === m.id ? 'var(--color-accent)' : 'var(--color-text-secondary)',
                fontWeight: settings.themeMode === m.id ? 700 : 400,
                cursor: 'pointer',
                fontSize: '0.875rem',
                transition: 'border-color var(--transition-fast), background var(--transition-fast)',
              }}
            >
              {m.icon} {m.label}
            </button>
          ))}
        </div>
        <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 'var(--space-2)' }}>
          Auto follows your device's dark/light preference.
        </p>
      </Section>

      {/* Workspace members (admin only) */}
      {accessStatus === 'member' && (
        <Section
          title="Workspace Members"
          action={
            !membersLoaded ? (
              <button className="btn btn-secondary btn-sm" onClick={loadMembers}>Load members</button>
            ) : undefined
          }
        >
          {!membersLoaded ? (
            <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
              Click "Load members" to view and manage workspace access.
            </p>
          ) : (
            <>
              {workspaceMembers.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', marginBottom: 'var(--space-5)' }}>
                {workspaceMembers.map((member) => (
                  <div key={member.id} style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-3)',
                    padding: 'var(--space-3) var(--space-4)',
                    background: 'var(--color-surface-raised)',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--color-border)',
                  }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: '50%',
                      background: 'var(--color-accent-light)', color: 'var(--color-accent)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontWeight: 700, fontSize: '0.875rem', flexShrink: 0,
                    }}>
                      {(member.fullName || member.email || '?')[0]?.toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: '0.875rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {member.fullName || member.email}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textTransform: 'capitalize' }}>
                        {member.role}
                        {member.userId === user?.id && ' (you)'}
                      </div>
                    </div>
                    {isAdmin && member.userId !== user?.id && member.role !== 'owner' && (
                      <button
                        className="btn btn-ghost btn-sm"
                        style={{ color: 'var(--color-unpaid)', flexShrink: 0 }}
                        onClick={() => handleRemove(member)}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

              {removeError && (
                <div className="alert alert-error" style={{ marginBottom: 'var(--space-4)' }}>{removeError}</div>
              )}

              {isAdmin && (
                <div>
                  <div className="section-label">Add member by email</div>
                  <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
                    <input
                      className="input"
                      type="email"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      placeholder="member@example.com"
                      style={{ flex: 1, minWidth: 200 }}
                    />
                    <select
                      className="select"
                      value={inviteRole}
                      onChange={(e) => setInviteRole(e.target.value as 'admin' | 'member')}
                      style={{ width: 120 }}
                    >
                      <option value="member">Member</option>
                      <option value="admin">Admin</option>
                    </select>
                    <button className="btn btn-primary" onClick={handleInvite} disabled={inviting}>
                      {inviting ? <span className="spinner" style={{ width: 16, height: 16 }} /> : 'Add'}
                    </button>
                  </div>
                  {inviteError && <div className="alert alert-error mt-3">{inviteError}</div>}
                  {inviteSuccess && <div className="alert alert-success mt-3">{inviteSuccess}</div>}
                  <p className="field-hint mt-2">
                    The person must first create an account in the app, then you can add them here.
                  </p>
                </div>
              )}

              {!isAdmin && (
                <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                  Only admins can add or remove workspace members.
                </p>
              )}
            </>
          )}
        </Section>
      )}

      {/* Realtime status */}
      <Section title="Sync Status">
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <div className="realtime-dot" />
          <span style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>
            Realtime sync active — changes appear instantly for all workspace members.
          </span>
        </div>
      </Section>

      {/* Last export */}
      {settings.lastExportDate && (
        <div className="alert alert-info" style={{ fontSize: '0.8125rem' }}>
          Last backup exported: {formatDateShort(settings.lastExportDate.split('T')[0])}
        </div>
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
