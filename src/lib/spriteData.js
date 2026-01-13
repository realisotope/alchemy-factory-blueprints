// Spritesheet data and mappings
import { MATERIAL_MAPPINGS, BUILDING_MAPPINGS } from './blueprintMappings';
import { parseSpritesheet } from './spriteHelper';

const SPRITE_CONFIG = {
  columns: 4,
  cellWidth: 64,
  cellHeight: 64
};

// Extract sprite order from mappings (excluding "None" from materials)
const materialSpriteOrder = Object.values(MATERIAL_MAPPINGS)
  .map(m => m.id)
  .filter(id => id !== 'none');

const buildingSpriteOrder = Object.values(BUILDING_MAPPINGS).map(b => b.id);

export const MATERIAL_SPRITES = parseSpritesheet(
  materialSpriteOrder,
  '/icons/spritesheet-materials-64.webp',
  SPRITE_CONFIG
);

export const BUILDING_SPRITES = parseSpritesheet(
  buildingSpriteOrder,
  '/icons/spritesheet-buildings-64.webp',
  SPRITE_CONFIG
);

export function getMaterialSprite(materialId) {
  return MATERIAL_SPRITES[materialId] || null;
}

export function getBuildingSprite(buildingId) {
  return BUILDING_SPRITES[buildingId] || null;
}
