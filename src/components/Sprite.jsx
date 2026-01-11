// Sprite component for rendering spritesheet icons
import { memo } from 'react';
import { getSpriteStyle } from '../lib/spriteHelper';
import Tooltip from './Tooltip';

const Sprite = memo(function Sprite({ sprite, alt, className = '' }) {
  if (!sprite) {
    return <span className="text-xs text-gray-400">No icon</span>;
  }

  const style = getSpriteStyle(sprite);

  return (
    <Tooltip title={alt} position="top">
      <div
        className={`${className} cursor-help`}
        style={style}
        role="img"
      />
    </Tooltip>
  );
});

export default Sprite;
