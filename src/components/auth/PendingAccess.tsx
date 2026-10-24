import { useState } from 'react';
import type { PersonLinkCandidate } from '../../types';
import { useAppStore } from '../../store/appStore';

function formatCandidateDetail(candidate: PersonLinkCandidate): string {
  if (candidate.matchReason === 'email' && candidate.email) {
    return candidate.email;
  }

  if (candidate.matchReason === 'phone' && candidate.phone) {
    return candidate.phone;
  }

  if (candidate.email) {
    return candidate.email;
  }

  if (candidate.phone) {
    return candidate.phone;
  }

  return 'Name match';
}

export function PendingAccess() {
  const { user, signOut, linkResolution, confirmPersonLink } = useAppStore();
  const [submittingPersonId, setSubmittingPersonId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  async function handleConfirm(personId: string) {
    setSubmittingPersonId(personId);
    setError('');
    const nextError = await confirmPersonLink(personId);
    if (nextError) {
      setError(nextError);
    }
    setSubmittingPersonId(null);
  }

  function copyEmail() {
    if (user?.email) {
      void navigator.clipboard.writeText(user.email);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    }
  }

  const hasCandidates = linkResolution.status === 'needs-confirmation' || linkResolution.status === 'ambiguous';

  return (
    <div className="pending-access-shell">
      <div className="pending-access-card">
        <div className="pending-access-icon">🔒</div>
        <h2 style={{ marginBottom: 'var(--space-3)' }}>
          {hasCandidates ? 'Confirm your match' : 'Access pending'}
        </h2>
        <p style={{ marginBottom: 'var(--space-2)', color: 'var(--color-text-secondary)' }}>
          Signed in as:
        </p>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-5)', background: 'var(--color-surface-raised)', padding: '6px 14px', borderRadius: 'var(--radius-full)', border: '1px solid var(--color-border)' }}>
          <strong style={{ fontSize: '0.875rem', color: 'var(--color-text-primary)' }}>{user?.email}</strong>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={copyEmail}
            style={{ padding: '2px 8px', fontSize: '0.75rem', height: 'auto', minHeight: 24 }}
            title="Copy email address"
          >
            {copied ? '✓ Copied' : 'Copy email'}
          </button>
        </div>

        {linkResolution.status === 'needs-confirmation' && linkResolution.candidates[0] && (
          <div className="card card-padded" style={{ marginBottom: 'var(--space-4)', textAlign: 'left' }}>
            <div style={{ fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: 'var(--space-2)' }}>
              We found a possible match for you in Fajr Brews records.
            </div>
            <div style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-4)' }}>
              Link your account to <strong>{linkResolution.candidates[0].name}</strong> so we can show only the finalized orders you joined.
            </div>
            <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', marginBottom: 'var(--space-4)' }}>
              Match signal: {formatCandidateDetail(linkResolution.candidates[0])}
            </div>
            <button
              className="btn btn-primary"
              onClick={() => handleConfirm(linkResolution.candidates[0].personId)}
              disabled={submittingPersonId === linkResolution.candidates[0].personId}
            >
              {submittingPersonId === linkResolution.candidates[0].personId ? <span className="spinner" style={{ width: 16, height: 16 }} /> : 'Link my account'}
            </button>
          </div>
        )}

        {linkResolution.status === 'ambiguous' && linkResolution.candidates.length > 0 && (
          <div className="card card-padded" style={{ marginBottom: 'var(--space-4)', textAlign: 'left' }}>
            <div style={{ fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: 'var(--space-2)' }}>
              We found a few possible matches for you.
            </div>
            <div style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-4)' }}>
              Pick the record that belongs to you and we will link your account.
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              {linkResolution.candidates.map((candidate) => (
                <button
                  key={candidate.personId}
                  className="btn btn-secondary"
                  style={{ justifyContent: 'space-between', textAlign: 'left' }}
                  onClick={() => handleConfirm(candidate.personId)}
                  disabled={submittingPersonId === candidate.personId}
                >
                  <span>
                    {candidate.name}
                    <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
                      {formatCandidateDetail(candidate)}
                    </span>
                  </span>
                  {submittingPersonId === candidate.personId ? <span className="spinner" style={{ width: 16, height: 16 }} /> : 'Link'}
                </button>
              ))}
            </div>
          </div>
        )}

        {!hasCandidates && (
          <p style={{ marginBottom: 'var(--space-6)', color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
            We could not match this account to any existing Fajr Brews person record yet. If you should already be in archived orders, ask an admin to check the email, phone number, or name saved for you.
          </p>
        )}

        {error && (
          <div className="alert alert-error" style={{ marginBottom: 'var(--space-4)', textAlign: 'left' }}>
            {error}
          </div>
        )}

        <button className="btn btn-secondary" onClick={signOut}>
          Sign out
        </button>
      </div>
    </div>
  );
}
