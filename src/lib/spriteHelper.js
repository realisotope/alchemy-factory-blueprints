// Sprite helper utilities for rendering icons from spritesheets

/**
 * Generates CSS background-position style for a sprite
 * @param {Object} sprite - Sprite data from JSON
 * @param {number} sprite.x - X coordinate in spritesheet
 * @param {number} sprite.y - Y coordinate in spritesheet
 * @param {number} sprite.width - Sprite width (typically 64)
 * @param {number} sprite.height - Sprite height (typically 64)
 * @returns {Object} CSS style object for sprite rendering
 */
export function getSpriteStyle(sprite) {
  if (!sprite) return {};
  
  return {
    backgroundImage: sprite.spritesheet,
    backgroundPosition: `-${sprite.x}px -${sprite.y}px`,
    backgroundSize: `${sprite.sheetWidth}px ${sprite.sheetHeight}px`,
    width: `${sprite.width}px`,
    height: `${sprite.height}px`,
    display: 'inline-block'
    //imageRendering: 'pixelated'
  };
}

/**
 * Loads and parses a spritesheet from an ordered array of sprite names
 * @param {Array<string>} spriteNames - Ordered array of sprite names
 * @param {string} spritesheetUrl - URL to the spritesheet image
 * @param {Object} config - Spritesheet configuration
 * @param {number} config.columns - Number of columns in spritesheet
 * @param {number} config.cellWidth - Width of each sprite cell
 * @param {number} config.cellHeight - Height of each sprite cell
 * @returns {Object} Map of sprite name to sprite data
 */
export function parseSpritesheet(spriteNames, spritesheetUrl, config) {
  const sprites = {};
  
  if (!Array.isArray(spriteNames) || spriteNames.length === 0) {
    return sprites;
  }
  
  const { columns = 4, cellWidth = 64, cellHeight = 64 } = config;
  
  // Calculate sheet dimensions based on sprite count
  const rows = Math.ceil(spriteNames.length / columns);
  const sheetWidth = columns * cellWidth;
  const sheetHeight = rows * cellHeight;
  
  spriteNames.forEach((spriteName, index) => {
    // Calculate position based on index (sprites are laid out in columns)
    const col = index % columns;
    const row = Math.floor(index / columns);
    
    sprites[spriteName] = {
      x: col * cellWidth,
      y: row * cellHeight,
      width: cellWidth,
      height: cellHeight,
      spritesheet: `url(${spritesheetUrl})`,
      sheetWidth,
      sheetHeight,
      name: spriteName
    };
  });
  
  return sprites;
}
