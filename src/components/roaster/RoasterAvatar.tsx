import { useEffect, useState } from 'react';
import { getRoasterInitials } from '../../lib/roasters';

interface RoasterAvatarProps {
  name?: string | null;
  logoUrl?: string;
  size?: number;
  alt?: string;
  className?: string;
}

export function RoasterAvatar({
  name,
  logoUrl,
  size = 44,
  alt,
  className = '',
}: RoasterAvatarProps) {
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [logoUrl]);

  const showImage = Boolean(logoUrl) && !imageFailed;
  const initials = getRoasterInitials(name);

  return (
    <span
      className={`roaster-avatar ${className}`.trim()}
      style={{ width: size, height: size }}
      aria-label={alt ?? (name ? `${name} logo` : 'Roaster placeholder')}
    >
      {showImage ? (
        <img
          src={logoUrl}
          alt={alt ?? (name ? `${name} logo` : 'Roaster logo')}
          className="roaster-avatar-image"
          onError={() => setImageFailed(true)}
        />
      ) : (
        <span className="roaster-avatar-fallback" aria-hidden="true">
          {initials}
        </span>
      )}
    </span>
  );
}
