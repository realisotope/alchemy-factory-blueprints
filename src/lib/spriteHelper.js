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
    width: `${sprite.width}px`,
    height: `${sprite.height}px`,
    backgroundSize: `${sprite.sheetWidth}px ${sprite.sheetHeight}px`,
    display: 'inline-block'
    //imageRendering: 'pixelated'
  };
}

/**
 * Loads and parses a spritesheet JSON file
 * @param {Object} json - Spritesheet JSON data
 * @param {string} spritesheetUrl - URL to the spritesheet image
 * @returns {Object} Map of sprite name to sprite data
 */
export function parseSpritesheet(json, spritesheetUrl) {
  const sprites = {};
  
  if (!json.layers || !json.layers[0] || !json.layers[0].sprites) {
    return sprites;
  }
  
  const columns = json.columns || 4;
  const cellWidth = json.manualCellWidth || 64;
  const cellHeight = json.manualCellHeight || 64;
  
  // Calculate sheet dimensions based on sprite count
  const spriteList = json.layers[0].sprites;
  const rows = Math.ceil(spriteList.length / columns);
  const sheetWidth = columns * cellWidth;
  const sheetHeight = rows * cellHeight;
  
  spriteList.forEach((sprite, index) => {
    // Calculate position based on index (sprites are laid out in columns)
    const col = index % columns;
    const row = Math.floor(index / columns);
    
    sprites[sprite.name] = {
      x: col * cellWidth,
      y: row * cellHeight,
      width: cellWidth,
      height: cellHeight,
      spritesheet: `url(${spritesheetUrl})`,
      sheetWidth,
      sheetHeight,
      name: sprite.name
    };
  });
  
  return sprites;
}
