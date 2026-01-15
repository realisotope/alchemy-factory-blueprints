// Sprite component for rendering spritesheet icons

import { memo } from 'react';
import { getSpriteStyle } from '../lib/spriteHelper';
import Tooltip from './Tooltip';

const Sprite = memo(
  function Sprite({ sprite, alt, className = '', size = 1 }) {
    if (!sprite) {
      return <span className="text-xs text-gray-400">No icon</span>;
    }

    const style = getSpriteStyle(sprite);
    
    // Apply scaling transform to fit smaller containers without clipping
    if (size !== 1) {
      style.transform = `scale(${size})`;
      style.transformOrigin = 'top left';
    }

    return (
      <Tooltip title={alt} position="top">
        <div
          className={`${className} cursor-help`}
          style={style}
          role="img"
        />
      </Tooltip>
    );
  },
  // Custom comparison: only re-render if sprite ID or size changes
  (prevProps, nextProps) => {
    return (
      prevProps.sprite?.id === nextProps.sprite?.id &&
      prevProps.size === nextProps.size &&
      prevProps.className === nextProps.className &&
      prevProps.alt === nextProps.alt
    );
  }
);

export default Sprite;
