/**
 * Avatar — user portrait with initials fallback.
 */

import { initials } from '../../lib/format';

export interface AvatarProps {
  name: string;
  src?: string | null;
  size?: number;
  title?: string;
}

export function Avatar({ name, src, size = 40, title }: AvatarProps): JSX.Element {
  const dimension = { width: size, height: size };

  if (src) {
    return (
      <img
        className="avatar"
        style={dimension}
        src={src}
        alt={`${name}'s avatar`}
        title={title ?? name}
        loading="lazy"
      />
    );
  }

  return (
    <span
      className="avatar avatar--initials"
      style={{ ...dimension, fontSize: Math.max(11, size * 0.38) }}
      role="img"
      aria-label={name}
      title={title ?? name}
    >
      {initials(name)}
    </span>
  );
}
