/**
 * Multi-part blueprint utilities
 * Handles combining, validating, and managing multi-part blueprints
 */

export function combineParts(parts) {
  if (!Array.isArray(parts) || parts.length === 0) {
    return {
      Materials: {},
      Buildings: {},
      BuildingBreakdownCost: {},
      GridArea: { x: 0, y: 0 }
    };
  }

  const combined = {
    Materials: {},
    Buildings: {},
    BuildingBreakdownCost: {},
    GridArea: { x: 0, y: 0 },
    MinTierRequired: 0,
    InventorySlotsRequired: 0
  };

  parts.forEach(part => {
    if (!part.parsed) return;

    const parsed = part.parsed;

    // Merge materials - sum quantities
    if (parsed.Materials && typeof parsed.Materials === 'object') {
      Object.entries(parsed.Materials).forEach(([key, quantity]) => {
        if (typeof quantity === 'number' && quantity >= 0) {
          combined.Materials[key] = (combined.Materials[key] || 0) + quantity;
        }
      });
    }

    // Merge buildings - sum quantities
    if (parsed.Buildings && typeof parsed.Buildings === 'object') {
      Object.entries(parsed.Buildings).forEach(([key, quantity]) => {
        if (typeof quantity === 'number' && quantity >= 0) {
          combined.Buildings[key] = (combined.Buildings[key] || 0) + quantity;
        }
      });
    }

    // Merge building breakdown costs
    if (parsed.BuildingBreakdownCost && typeof parsed.BuildingBreakdownCost === 'object') {
      Object.entries(parsed.BuildingBreakdownCost).forEach(([buildingName, costs]) => {
        if (typeof costs === 'object' && costs !== null) {
          if (!combined.BuildingBreakdownCost[buildingName]) {
            combined.BuildingBreakdownCost[buildingName] = {};
          }
          Object.entries(costs).forEach(([materialName, cost]) => {
            if (typeof cost === 'number' && cost >= 0) {
              combined.BuildingBreakdownCost[buildingName][materialName] = 
                (combined.BuildingBreakdownCost[buildingName][materialName] || 0) + cost;
            }
          });
        }
      });
    }

    // Sum grid area
    if (parsed.GridArea && typeof parsed.GridArea === 'object') {
      if (typeof parsed.GridArea.x === 'number') {
        combined.GridArea.x += parsed.GridArea.x;
      }
      if (typeof parsed.GridArea.y === 'number') {
        combined.GridArea.y += parsed.GridArea.y;
      }
    }

    // Take maximum of MinTierRequired (highest tier needed across all parts)
    if (typeof parsed.MinTierRequired === 'number' && parsed.MinTierRequired > combined.MinTierRequired) {
      combined.MinTierRequired = parsed.MinTierRequired;
    }

    // Sum InventorySlotsRequired (total slots needed across all parts)
    if (typeof parsed.InventorySlotsRequired === 'number' && parsed.InventorySlotsRequired >= 0) {
      combined.InventorySlotsRequired += parsed.InventorySlotsRequired;
    }
  });

  return combined;
}

// Validates that parts array has correct structure
export function validateParts(parts) {
  if (!Array.isArray(parts) || parts.length === 0) {
    return false;
  }

  // Check all parts have required fields
  return parts.every((part, idx) => {
    return (
      Number.isInteger(part.part_number) &&
      part.part_number === idx + 1 &&
      typeof part.filename === 'string' &&
      part.filename.length > 0 &&
      typeof part.file_hash === 'string' &&
      part.file_hash.length > 0 &&
      typeof part.parsed === 'object' &&
      part.parsed !== null
    );
  });
}

export function getPartDisplayName(partNumber) {
  return `Part ${partNumber}`;
}

export function getParsedData(blueprint) {
  if (blueprint.is_multi_part && blueprint.parts && Array.isArray(blueprint.parts)) {
    return combineParts(blueprint.parts);
  }
  return blueprint.parsed || {};
}

export function getPartByNumber(blueprint, partNumber) {
  if (!blueprint.is_multi_part || !blueprint.parts || !Array.isArray(blueprint.parts)) {
    return null;
  }
  return blueprint.parts.find(p => p.part_number === partNumber) || null;
}

export function getPartDownloadInfo(blueprint) {
  if (!blueprint.is_multi_part || !blueprint.parts || !Array.isArray(blueprint.parts)) {
    return [];
  }
  return blueprint.parts.map(part => ({
    part_number: part.part_number,
    filename: part.filename,
    file_hash: part.file_hash
  }));
}

export function isValidBlueprint(blueprint) {
  if (!blueprint) return false;

  if (blueprint.is_multi_part) {
    return validateParts(blueprint.parts);
  }

  return blueprint.parsed && typeof blueprint.parsed === 'object';
}
