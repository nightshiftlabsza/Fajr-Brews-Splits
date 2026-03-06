import { useAppStore } from '../../store/appStore';

export function PendingAccess() {
  const { user, signOut } = useAppStore();

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--color-bg)',
      padding: 'var(--space-4)',
    }}>
      <div style={{
        width: '100%',
        maxWidth: 420,
        textAlign: 'center',
      }}>
        <div style={{ fontSize: '3rem', marginBottom: 'var(--space-4)' }}>🔒</div>
        <h2 style={{ marginBottom: 'var(--space-3)' }}>Access Pending</h2>
        <p style={{ marginBottom: 'var(--space-2)', color: 'var(--color-text-secondary)' }}>
          Your account <strong>{user?.email}</strong> is registered but hasn't been added to the
          Fajr Brews workspace yet.
        </p>
        <p style={{ marginBottom: 'var(--space-6)', color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
          Contact your Fajr Brews admin and ask them to add your account. Once approved, sign in
          again and you'll have full access.
        </p>
        <button className="btn btn-secondary" onClick={signOut}>
          Sign out
        </button>
      </div>
    </div>
  );
}
