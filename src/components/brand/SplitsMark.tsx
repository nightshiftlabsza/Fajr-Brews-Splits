export interface SplitsMarkProps {
  size?: number;
  className?: string;
  variant?: 'default' | 'print';
}

export function SplitsMark({ size = 32, className, variant = 'default' }: SplitsMarkProps) {
  const isPrint = variant === 'print';

  return (
    <svg
      viewBox="0 0 32 32"
      width={size}
      height={size}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
      className={className ? `splits-mark ${className}` : 'splits-mark'}
      style={isPrint ? undefined : { color: 'var(--color-accent)', display: 'block', flexShrink: 0 }}
    >
      <path
        d="M15 3.1C8.4 3.6 3.5 9.2 3.5 16S8.4 28.4 15 28.9V3.1Z"
        fill={isPrint ? '#000000' : 'currentColor'}
      />
      <path
        d="M17 3.1v25.8c6.6-.5 11.5-6.1 11.5-12.9S23.6 3.6 17 3.1Z"
        fill={isPrint ? 'none' : 'currentColor'}
        fillOpacity={isPrint ? undefined : 0.42}
        stroke={isPrint ? '#000000' : undefined}
        strokeWidth={isPrint ? 1.6 : undefined}
      />
    </svg>
  );
}
