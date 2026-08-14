import { useState } from 'react';
import { useAppStore } from '../../store/appStore';
import type { Theme, ThemeMode, WorkspaceMember } from '../../types';
import { formatDateShort } from '../../lib/formatters';
import { ConfirmModal } from '../ui/ConfirmModal';

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
  const [removeTarget, setRemoveTarget] = useState<WorkspaceMember | null>(null);
  const [removing, setRemoving] = useState(false);

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
        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
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

      {/* Workspace members — Admin only */}
      {isAdmin && (
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
              <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-4)', flexWrap: 'wrap' }}>
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
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                  {workspaceMembers.map((member) => (
                    <div key={member.id} style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: 'var(--space-3)',
                      background: 'var(--color-surface-raised)',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--color-border)',
                      gap: 'var(--space-3)',
                    }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--color-text-primary)' }}>
                          {member.fullName || member.email || member.userId}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textTransform: 'capitalize' }}>
                          {member.role} · joined {formatDateShort(member.createdAt.split('T')[0])}
                        </div>
                      </div>
                      {member.userId !== user?.id && (
                        <button
                          className="btn btn-ghost btn-sm"
                          style={{ color: 'var(--color-unpaid)' }}
                          onClick={() => setRemoveTarget(member)}
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  ))}
                </div>
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
