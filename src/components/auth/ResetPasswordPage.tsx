import { AuthPage } from './AuthPage';

interface ResetPasswordPageProps {
  onComplete: () => void;
  onNavigateToSignIn?: () => void;
}

export function ResetPasswordPage({ onComplete, onNavigateToSignIn }: ResetPasswordPageProps) {
  return (
    <AuthPage
      initialMode="recovery"
      onRecoveryComplete={onComplete}
      onNavigateToSignIn={onNavigateToSignIn}
    />
  );
}
