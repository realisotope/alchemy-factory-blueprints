// Sprite component for rendering spritesheet icons
import { memo } from 'react';
import { getSpriteStyle } from '../lib/spriteHelper';

const Sprite = memo(function Sprite({ sprite, alt, className = '' }) {
  if (!sprite) {
    return <span className="text-xs text-gray-400">No icon</span>;
  }

  const style = getSpriteStyle(sprite);

  return (
    <div
      className={className}
      style={style}
      title={alt}
      aria-label={alt}
      role="img"
    />
  );
});

export default Sprite;
