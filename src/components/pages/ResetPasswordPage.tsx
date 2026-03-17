import { AuthPage } from '../auth/AuthPage';

interface ResetPasswordPageProps {
  onComplete: () => void;
}

export function ResetPasswordPage({ onComplete }: ResetPasswordPageProps) {
  return (
    <AuthPage
      initialMode="recovery"
      onRecoveryComplete={onComplete}
    />
  );
}
