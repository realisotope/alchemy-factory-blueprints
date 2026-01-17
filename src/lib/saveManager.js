/**
 * Save Manager - Handles save file uploads and localStorage management
 */

import { MATERIAL_MAPPINGS, BUILDING_MAPPINGS } from './blueprintMappings';
import { combineParts } from './blueprintUtils';

const SAVE_STORAGE_KEY = 'blueprintCompanionSaveData';
const SAVE_METADATA_KEY = 'blueprintCompanionSaveMetadata';

// Stores parsed save data in localStorage
export function saveSaveData(saveData, saveName = 'Loaded Save') {
  try {
    console.log('💾 saveSaveData called with name:', saveName);
    console.log('📊 Save data object:', saveData);
    
    const metadata = {
      loadedAt: new Date().toISOString(),
      saveName: saveName,
    };
    
    localStorage.setItem(SAVE_STORAGE_KEY, JSON.stringify(saveData));
    localStorage.setItem(SAVE_METADATA_KEY, JSON.stringify(metadata));
    
    console.log('✅ Save data successfully stored in localStorage');
    console.log('📋 Metadata:', metadata);
    
    return { success: true, message: `Save "${saveName}" loaded successfully` };
  } catch (error) {
    console.error('❌ Error saving to localStorage:', error);
    return { success: false, message: 'Failed to save data locally' };
  }
}

export function getSaveData() {
  try {
    const data = localStorage.getItem(SAVE_STORAGE_KEY);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error('Error retrieving save data:', error);
    return null;
  }
}

export function getSaveMetadata() {
  try {
    const metadata = localStorage.getItem(SAVE_METADATA_KEY);
    return metadata ? JSON.parse(metadata) : null;
  } catch (error) {
    console.error('Error retrieving save metadata:', error);
    return null;
  }
}

export function clearSaveData() {
  try {
    localStorage.removeItem(SAVE_STORAGE_KEY);
    localStorage.removeItem(SAVE_METADATA_KEY);
    return { success: true, message: 'Save data cleared' };
  } catch (error) {
    console.error('Error clearing save data:', error);
    return { success: false, message: 'Failed to clear save data' };
  }
}

export function hasSaveData() {
  return getSaveData() !== null;
}

// Checks blueprint compatibility against loaded save
export function checkBlueprintCompatibility(blueprint, saveData = null) {
  const save = saveData || getSaveData();
  
  if (!save) {
    console.warn('⚠️ No save data loaded for compatibility check');
    return {
      compatible: false,
      reason: 'No save data loaded',
      missingMaterials: {},
      hasMaterials: {},
      materials: {}
    };
  }

  console.log('🔍 Checking blueprint compatibility...');
  console.log('📦 Blueprint:', blueprint.name);

  const { parsed } = blueprint.is_multi_part
    ? { parsed: getParsedDataForCompatibility(blueprint) }
    : { parsed: blueprint.parsed };

  if (!parsed || !parsed.Materials) {
    console.log('✅ No materials required for this blueprint');
    return {
      compatible: true,
      reason: 'All items unlocked',
      missingMaterials: {},
      hasMaterials: {},
      materials: {}
    };
  }

  // Get unlocked materials and buildings from save
  const unlockedData = save.UnlockData || {};
  const unlockedMaterials = new Set(unlockedData.CraftingOptionList || []);
  const unlockedBuildings = new Set(unlockedData.ConstructOptionList || []);

  console.log('🔓 Unlocked materials count:', unlockedMaterials.size);
  console.log('🔓 Unlocked buildings count:', unlockedBuildings.size);

  const blueprintMaterials = parsed.Materials || {};
  const blueprintBuildings = parsed.Buildings || {};
  
  const missingMaterialsByDisplay = {};
  const hasMaterials = {};
  let isCompatible = true;

  // Check each material required by the blueprint
  Object.entries(blueprintMaterials).forEach(([parserKey, required]) => {
    const mapping = MATERIAL_MAPPINGS[parserKey];
    const displayName = mapping?.name || parserKey;
    
    if (!unlockedMaterials.has(parserKey)) {
      //console.warn(`🔒 Material locked: ${displayName} (${parserKey})`);
      missingMaterialsByDisplay[displayName] = true;
      isCompatible = false;
    } else {
      hasMaterials[displayName] = true;
    }
  });

  // Check each building required by the blueprint
  Object.entries(blueprintBuildings).forEach(([parserKey, required]) => {
    // Get the display name from mappings
    const mapping = BUILDING_MAPPINGS[parserKey];
    const displayName = mapping?.name || parserKey;
    
    if (!unlockedBuildings.has(parserKey)) {
      //console.warn(`🔒 Building locked: ${displayName} (${parserKey})`);
      missingMaterialsByDisplay[displayName] = true;
      isCompatible = false;
    } else {
      hasMaterials[displayName] = true;
    }
  });

  const result = {
    compatible: isCompatible,
    reason: isCompatible ? 'All items unlocked' : 'Missing unlocked items',
    missingMaterials: missingMaterialsByDisplay,
    hasMaterials,
    materials: blueprintMaterials,
    unlockedMaterials,
    unlockedBuildings
  };

  console.log('📊 Compatibility result:', result.reason);
  //console.log('📋 Missing/Locked items:', Object.keys(missingMaterialsByDisplay));

  return result;
}

// Helper to get parsed data for multi-part blueprints
function getParsedDataForCompatibility(blueprint) {
  if (!blueprint.is_multi_part || !blueprint.parts) {
    return blueprint.parsed || {};
  }

  // Use combineParts from blueprintUtils to properly combine all data
  return combineParts(blueprint.parts);
}

export function getSaveDisplayName() {
  const metadata = getSaveMetadata();
  if (!metadata) return null;
  
  const loadedAt = new Date(metadata.loadedAt);
  const hoursAgo = Math.floor((Date.Now() - loadedAt.getTime()) / (1000 * 60 * 60));
  
  let timeStr = '';
  if (hoursAgo === 0) {
    timeStr = 'just now';
  } else if (hoursAgo < 24) {
    timeStr = `${hoursAgo}h ago`;
  } else {
    const daysAgo = Math.floor(hoursAgo / 24);
    timeStr = `${daysAgo}d ago`;
  }
  
  return `${metadata.saveName} (${timeStr})`;
}

// Checks if recipes and supply items are unlocked
export function checkRecipesAndSupplyUnlocks(recipes = {}, supplyItems = {}, saveData = null) {
  const save = saveData || getSaveData();
  
  if (!save) {
    console.log('ℹ️ No save data loaded');
    return {
      recipes: {},
      supplyItems: {}
    };
  }

  const unlockedData = save.UnlockData || {};
  const unlockedRecipes = new Set(unlockedData.CraftingOptionList || []);
  const unlockedSupply = new Set(unlockedData.CraftingOptionList || []);

  const recipeStatus = {};
  Object.keys(recipes).forEach((recipe) => {
    recipeStatus[recipe] = unlockedRecipes.has(recipe);
    //console.log(`📜 Recipe "${recipe}": ${recipeStatus[recipe] ? '✅ unlocked' : '🔒 locked'}`);
  });

  const supplyStatus = {};
  Object.keys(supplyItems).forEach((supply) => {
    supplyStatus[supply] = unlockedSupply.has(supply);
    //console.log(`📦 Supply "${supply}": ${supplyStatus[supply] ? '✅ unlocked' : '🔒 locked'}`);
  });

  return {
    recipes: recipeStatus,
    supplyItems: supplyStatus
  };
}
