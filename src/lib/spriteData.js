// Spritesheet data and mappings
import materialsJson from './spritesheet-materials-64.json';
import buildingsJson from './spritesheet-buildings-64.json';
import { parseSpritesheet } from './spriteHelper';

export const MATERIAL_SPRITES = parseSpritesheet(
  materialsJson, 
  '/icons/spritesheet-materials-64.webp'
);

export const BUILDING_SPRITES = parseSpritesheet(
  buildingsJson,
  '/icons/spritesheet-buildings-64.webp'
);

export function getMaterialSprite(materialId) {
  return MATERIAL_SPRITES[materialId] || null;
}

export function getBuildingSprite(buildingId) {
  return BUILDING_SPRITES[buildingId] || null;
}
