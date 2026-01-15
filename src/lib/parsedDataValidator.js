/**
 * Validates and sanitizes parsed blueprint JSON data
 */

export function validateParsedData(parsed) {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return {
      Materials: {},
      Buildings: {},
      BuildingBreakdownCost: {},
      SupplyItems: {},
      Recipes: {},
    };
  }

  try {
    const sanitized = { ...parsed };
    
    if (typeof sanitized.Title === 'string') {
      sanitized.Title = sanitizeString(sanitized.Title);
    }
    if (typeof sanitized.Description === 'string') {
      sanitized.Description = sanitizeString(sanitized.Description);
    }
    if (typeof sanitized.ItemName === 'string') {
      sanitized.ItemName = sanitizeString(sanitized.ItemName);
    }
    if (typeof sanitized.Icon === 'string') {
      sanitized.Icon = sanitizeString(sanitized.Icon);
    }
    if (typeof sanitized.Color === 'string') {
      sanitized.Color = sanitizeString(sanitized.Color);
    }

    if (sanitized.Materials !== undefined) {
      if (typeof sanitized.Materials !== 'object' || Array.isArray(sanitized.Materials)) {
        sanitized.Materials = {};
      }
    } else {
      sanitized.Materials = {};
    }

    if (sanitized.Buildings !== undefined) {
      if (typeof sanitized.Buildings !== 'object' || Array.isArray(sanitized.Buildings)) {
        sanitized.Buildings = {};
      }
    } else {
      sanitized.Buildings = {};
    }

    if (sanitized.BuildingBreakdownCost !== undefined) {
      if (typeof sanitized.BuildingBreakdownCost !== 'object' || Array.isArray(sanitized.BuildingBreakdownCost)) {
        sanitized.BuildingBreakdownCost = {};
      }
    } else {
      sanitized.BuildingBreakdownCost = {};
    }

    if (sanitized.SupplyItems !== undefined) {
      if (typeof sanitized.SupplyItems !== 'object' || Array.isArray(sanitized.SupplyItems)) {
        sanitized.SupplyItems = {};
      }
    } else {
      sanitized.SupplyItems = {};
    }

    if (sanitized.Recipes !== undefined) {
      if (typeof sanitized.Recipes !== 'object' || Array.isArray(sanitized.Recipes)) {
        sanitized.Recipes = {};
      }
    } else {
      sanitized.Recipes = {};
    }

    if (sanitized.MinTierRequired !== undefined) {
      if (!Number.isInteger(sanitized.MinTierRequired) || sanitized.MinTierRequired < 0) {
        sanitized.MinTierRequired = undefined;
      }
    }

    if (sanitized.InventorySlotsRequired !== undefined) {
      if (!Number.isInteger(sanitized.InventorySlotsRequired) || sanitized.InventorySlotsRequired < 0) {
        sanitized.InventorySlotsRequired = undefined;
      }
    }

    if (sanitized.GridArea !== undefined) {
      if (typeof sanitized.GridArea === 'object' && !Array.isArray(sanitized.GridArea)) {
        const gridArea = sanitized.GridArea;
        if (Number.isInteger(gridArea.x) && Number.isInteger(gridArea.y) && 
            gridArea.x >= 0 && gridArea.x <= 1000 && 
            gridArea.y >= 0 && gridArea.y <= 1000) {
        } else {
          sanitized.GridArea = undefined;
        }
      } else {
        sanitized.GridArea = undefined;
      }
    }

    return sanitized;
  } catch (error) {
    console.error('[Security] Error validating parsed data:', error);
    return {
      Materials: {},
      Buildings: {},
      BuildingBreakdownCost: {},
      SupplyItems: {},
      Recipes: {},
    };
  }
}

function isValidMaterialsObject(materials) {
  if (!materials || typeof materials !== 'object' || Array.isArray(materials)) {
    return false;
  }

  for (const [key, value] of Object.entries(materials)) {
    if (typeof key !== 'string' || key.length > 100) {
      return false;
    }
    if (!Number.isInteger(value) || value < 0 || value > 999999) {
      return false;
    }
  }

  return true;
}

function isValidBuildingsObject(buildings) {
  if (!buildings || typeof buildings !== 'object' || Array.isArray(buildings)) {
    return false;
  }

  for (const [key, value] of Object.entries(buildings)) {
    if (typeof key !== 'string' || key.length > 100) {
      return false;
    }
    if (!Number.isInteger(value) || value < 0 || value > 999999) {
      return false;
    }
  }

  return true;
}

function isValidBreakdownCost(breakdown) {
  if (!breakdown || typeof breakdown !== 'object' || Array.isArray(breakdown)) {
    return false;
  }

  for (const [buildingName, costs] of Object.entries(breakdown)) {
    if (typeof buildingName !== 'string' || buildingName.length > 100) {
      return false;
    }

    if (!costs || typeof costs !== 'object' || Array.isArray(costs)) {
      return false;
    }

    for (const [materialName, cost] of Object.entries(costs)) {
      if (typeof materialName !== 'string' || materialName.length > 100) {
        return false;
      }
      if (!Number.isInteger(cost) || cost < 0 || cost > 999999) {
        return false;
      }
    }
  }

  return true;
}

function isValidGridArea(gridArea) {
  if (!gridArea || typeof gridArea !== 'object' || Array.isArray(gridArea)) {
    return false;
  }

  return (
    Number.isInteger(gridArea.x) && gridArea.x >= 0 && gridArea.x <= 1000 &&
    Number.isInteger(gridArea.y) && gridArea.y >= 0 && gridArea.y <= 1000
  );
}

function sanitizeString(str) {
  if (!str || typeof str !== 'string') {
    return '';
  }

  str = str.substring(0, 10000);
  str = str.replace(/\0/g, '');
  str = str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

  return str;
}

/**
 * Validates that a value is a safe number
 */
export function isValidNumber(value, min = -Infinity, max = Infinity) {
  return (
    Number.isFinite(value) &&
    !Number.isNaN(value) &&
    value >= min &&
    value <= max
  );
}
