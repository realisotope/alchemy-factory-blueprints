import { ChevronDown, LayoutGrid, LayoutList } from "lucide-react";
import { useState, memo } from "react";
import { useTheme } from "../lib/ThemeContext";
import Sprite from "./Sprite";
import { getMaterialSprite, getBuildingSprite } from "../lib/spriteData";
import { BUILDING_MAPPINGS, MATERIAL_MAPPINGS } from "../lib/blueprintMappings";

const BlueprintStats = memo(function BlueprintStats({ 
  materials = [], 
  buildings = [],
  parsedBuildings = {},
  minTier,
  inventorySlots,
  gridSize,
  productionRate,
  buildingBreakdownCost = {}
}) {
  const { theme } = useTheme();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isCompact, setIsCompact] = useState(false);
  const [activeTab, setActiveTab] = useState("materials"); // materials/buildings/breakdown tabs.
  const buildingNameToParserKey = {};
  Object.entries(BUILDING_MAPPINGS).forEach(([parserKey, mapping]) => {
    buildingNameToParserKey[mapping.name] = parserKey;
  });

  if (!materials.length && !buildings.length) {
    return null;
  }

  const hasMaterials = materials.length > 0;
  const hasBuildings = buildings.length > 0;

  return (
    <div style={{ borderColor: theme.colors.cardBorder }} className="border-2 rounded-md overflow-hidden">
      {/* Header with tabs */}
      <div
        style={{
          backgroundImage: `linear-gradient(to right, ${theme.colors.gradientFrom}30, ${theme.colors.gradientTo}30)`,
        }}
        className="flex items-center justify-between hover:opacity-80 transition"
        onMouseEnter={(e) => e.currentTarget.style.backgroundImage = `linear-gradient(to right, ${theme.colors.gradientFrom}60, ${theme.colors.gradientTo}60)`}
        onMouseLeave={(e) => e.currentTarget.style.backgroundImage = `linear-gradient(to right, ${theme.colors.gradientFrom}30, ${theme.colors.gradientTo}30)`}
      >
        {/* Tab buttons */}
        <div className="flex gap-0 flex-1">
          {hasMaterials && (
            <button
              onClick={() => {
                if (activeTab === "materials") {
                  setIsExpanded(!isExpanded);
                } else {
                  setActiveTab("materials");
                  setIsExpanded(true);
                }
              }}
              className="flex items-center justify-center gap-2 flex-1 py-3 transition"
              style={{
                color: activeTab === "materials" && isExpanded ? theme.colors.accentYellow : theme.colors.textSecondary,
                borderBottom: activeTab === "materials" && isExpanded ? `2px solid ${theme.colors.accentYellow}` : "2px solid transparent",
              }}
            >
              <h3 className="text-lg font-bold leading-none">Materials</h3>
              <span style={{ color: theme.colors.accentYellow }} className="text-lg font-semibold leading-none">
                ({materials.length})
              </span>
              <ChevronDown 
                className={`w-6 h-6 transition-transform ${isExpanded && activeTab === "materials" ? "rotate-180" : ""}`}
                style={{ color: activeTab === "materials" && isExpanded ? theme.colors.accentYellow : theme.colors.textSecondary }}
              />
            </button>
          )}
          {hasBuildings && (
            <button
              onClick={() => {
                if (activeTab === "buildings") {
                  setIsExpanded(!isExpanded);
                } else {
                  setActiveTab("buildings");
                  setIsExpanded(true);
                }
              }}
              className="flex items-center justify-center gap-2 flex-1 py-2 transition"
              style={{
                color: activeTab === "buildings" && isExpanded ? theme.colors.accentYellow : theme.colors.textSecondary,
                borderBottom: activeTab === "buildings" && isExpanded ? `2px solid ${theme.colors.accentYellow}` : "2px solid transparent",
              }}
            >
              <h3 className="text-lg font-bold leading-none">Buildings</h3>
              <span style={{ color: theme.colors.accentYellow }} className="text-lg font-semibold leading-none">
                ({buildings.length})
              </span>
              <ChevronDown 
                className={`w-6 h-6 transition-transform ${isExpanded && activeTab === "buildings" ? "rotate-180" : ""}`}
                style={{ color: activeTab === "buildings" && isExpanded ? theme.colors.accentYellow : theme.colors.textSecondary }}
              />
            </button>
          )}
          {hasMaterials && hasBuildings && (
            <button
              onClick={() => {
                if (activeTab === "breakdown") {
                  setIsExpanded(!isExpanded);
                } else {
                  setActiveTab("breakdown");
                  setIsExpanded(true);
                }
              }}
              className="flex items-center justify-center gap-2 flex-1 py-2 transition"
              style={{
                color: activeTab === "breakdown" && isExpanded ? theme.colors.accentYellow : theme.colors.textSecondary,
                borderBottom: activeTab === "breakdown" && isExpanded ? `2px solid ${theme.colors.accentYellow}` : "2px solid transparent",
              }}
            >
              <h3 className="text-lg font-bold leading-none">Breakdown</h3>
              <ChevronDown 
                className={`w-6 h-6 transition-transform ${isExpanded && activeTab === "breakdown" ? "rotate-180" : ""}`}
                style={{ color: activeTab === "breakdown" && isExpanded ? theme.colors.accentYellow : theme.colors.textSecondary }}
              />
            </button>
          )}
        </div>
      </div>

      {/* Metadata badges */}
      {(minTier !== undefined || inventorySlots !== undefined || gridSize) && (
        <div 
          style={{ 
            backgroundImage: `linear-gradient(to right, ${theme.colors.gradientFrom}10, ${theme.colors.gradientTo}10)`,
            borderTopColor: theme.colors.cardBorder 
          }}
          className="border-t-2 px-3 py-3 flex justify-around items-center flex-wrap gap-2"
        >
          {minTier !== undefined && (
            <div className="flex items-center gap-2">
              <span style={{ color: theme.colors.accentYellow }} className="text-sm font-semibold">Min Tier:</span>
              <span 
                style={{ 
                  color: theme.colors.accentYellow,
                  backgroundColor: theme.colors.cardBg,
                  borderColor: theme.colors.cardBorder
                }} 
                className="px-3 py-0.5 rounded border text-sm font-bold"
              >
                {minTier}
              </span>
            </div>
          )}
          {inventorySlots !== undefined && (
            <div className="flex items-center gap-2">
              <span style={{ color: theme.colors.accentYellow }} className="text-sm font-semibold">Inventory Slots:</span>
              <span 
                style={{ 
                  color: theme.colors.accentYellow,
                  backgroundColor: theme.colors.cardBg,
                  borderColor: theme.colors.cardBorder
                }} 
                className="px-3 py-0.5 rounded border text-sm font-bold"
              >
                {inventorySlots}
              </span>
            </div>
          )}
          {gridSize && (
            <div className="flex items-center gap-2">
              <span style={{ color: theme.colors.accentYellow }} className="text-sm font-semibold">Grid Size:</span>
              <span 
                style={{ 
                  color: theme.colors.accentYellow,
                  backgroundColor: theme.colors.cardBg,
                  borderColor: theme.colors.cardBorder
                }} 
                className="px-3 py-0.5 rounded border text-sm font-bold"
              >
                {gridSize.x} × {gridSize.y}
              </span>
            </div>
          )}
          {/* Production Rate - TEMPORARILY DISABLED */}
          {false && productionRate && (
            <div className="flex items-center gap-2">
              <span style={{ color: theme.colors.accentYellow }} className="text-sm font-semibold">Production Rate:</span>
              <span 
                style={{ 
                  color: theme.colors.accentYellow,
                  backgroundColor: theme.colors.cardBg,
                  borderColor: theme.colors.cardBorder
                }} 
                className="px-3 py-0.5 rounded border text-sm font-bold"
              >
                {productionRate} IPM
              </span>
            </div>
          )}
        </div>
      )}

      {/* Content */}
      {isExpanded && (
        <div style={{ backgroundImage: `linear-gradient(to right, ${theme.colors.gradientFrom}10, ${theme.colors.gradientTo}10)` }} className="p-3">
          {activeTab === "materials" ? (
            <div className="grid grid-cols-4 sm:grid-cols-5 lg:grid-cols-7 gap-1.5">
              {materials.map((material) => {
                const sprite = getMaterialSprite(material.id);
                return (
                  <div
                    key={material.id}
                    style={{
                      backgroundImage: `linear-gradient(to top, ${theme.colors.gradientFrom}30, ${theme.colors.gradientTo}30)`,
                      borderColor: theme.colors.cardBorder,
                    }}
                    className="rounded-lg border-2 shadow-lg p-1 text-center transition hover:shadow-lg flex flex-col items-center justify-center"
                  >
                    <div className="rounded flex items-center justify-center overflow-hidden w-16 h-16 mx-auto">
                      {sprite ? (
                        <Sprite sprite={sprite} alt={material.name} className="w-full h-full" />
                      ) : material.icon ? (
                        <img
                          src={material.icon}
                          alt={material.name}
                          className="w-full h-full object-cover"
                          loading="lazy"
                          decoding="async"
                        />
                      ) : (
                        <span style={{ color: theme.colors.textSecondary }} className="text-xs">No icon</span>
                      )}
                    </div>
                    <div className="font-bold -mt-0.5" style={{ color: theme.colors.accentYellow }}>
                      {material.quantity}
                    </div>
                    <div style={{ color: theme.colors.textSecondary }} className="text-xs truncate leading-none w-full px-0.5 -mt-0.5">
                      {material.name}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : activeTab === "buildings" ? (
            <div className="grid grid-cols-4 sm:grid-cols-5 lg:grid-cols-7 gap-1.5">
              {buildings.map((building) => {
                const sprite = getBuildingSprite(building.id);
                return (
                  <div
                    key={building.id}
                    style={{
                      backgroundImage: `linear-gradient(to top, ${theme.colors.gradientFrom}30, ${theme.colors.gradientTo}30)`,
                      borderColor: theme.colors.cardBorder,
                    }}
                    className="rounded-lg border-2 p-1 text-center transition hover:shadow-lg flex flex-col items-center justify-center"
                  >
                    <div className="rounded flex items-center justify-center overflow-hidden w-16 h-16 mx-auto">
                      {sprite ? (
                        <Sprite sprite={sprite} alt={building.name} className="w-full h-full" />
                      ) : building.icon ? (
                        <img
                          src={building.icon}
                          alt={building.name}
                          className="w-full h-full object-cover"
                          loading="lazy"
                          decoding="async"
                        />
                      ) : (
                        <span style={{ color: theme.colors.textSecondary }} className="text-xs">No icon</span>
                      )}
                    </div>
                    <div style={{ color: theme.colors.accentYellow }} className="font-bold -mt-0.5">
                      {building.quantity}
                    </div>
                    <div style={{ color: theme.colors.textSecondary }} className="text-xs truncate leading-none w-full px-0.5 -mt-0.5">
                      {building.name}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="space-y-3">
              {/* View Toggle Button */}
              <div className="flex justify-end px-1 mb-2">
                <button
                  onClick={() => setIsCompact(!isCompact)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded text-sm font-bold transition-colors border"
                  style={{
                    borderColor: theme.colors.cardBorder,
                    backgroundColor: `${theme.colors.cardBg}60`,
                    color: theme.colors.textSecondary,
                  }}
                >
                  {isCompact ? <LayoutGrid size={16} /> : <LayoutList size={16} />}
                  <span>{isCompact ? "Grid View" : "Compact View"}</span>
                </button>
              </div>

              {buildings.map((building) => {
                const sprite = getBuildingSprite(building.id);
                const parserKey = buildingNameToParserKey[building.name];
                const buildingMapping = BUILDING_MAPPINGS[parserKey];
                const hidePerUnit = buildingMapping?.hidePerUnit;
                
                let buildingBreakdownData = {};
                if (parserKey) {
                  buildingBreakdownData = buildingBreakdownCost[parserKey] || {};
                  
                  if (Object.keys(buildingBreakdownData).length === 0) {
                    const buildingMappingAliases = BUILDING_MAPPINGS[parserKey];
                    if (buildingMappingAliases?.aliases) {
                      for (const alias of buildingMapping.aliases) {
                        if (buildingBreakdownCost[alias]) {
                          buildingBreakdownData = buildingBreakdownCost[alias];
                          break;
                        }
                      }
                    }
                  }
                }
                const buildingMaterialEntries = Object.entries(buildingBreakdownData);
                
                // --- COMPACT VIEW ---
                if (isCompact) {
                  return (
                    <div
                      key={building.id}
                      className="flex items-center gap-4 py-2 px-3 border-b last:border-0"
                      style={{ borderColor: `${theme.colors.cardBorder}60` }}
                    >
                      {/* Left: Building Info */}
                      <div className="flex items-center gap-3 w-1/3 min-w-[200px]">
                        <div className="w-10 h-10 rounded overflow-hidden bg-black/20 flex-shrink-0">
                          {sprite ? (
                            <Sprite sprite={sprite} alt={building.name} className="w-full h-full" size={0.6} />
                          ) : building.icon ? (
                            <img src={building.icon} alt={building.name} className="w-full h-full object-cover" />
                          ) : null}
                        </div>
                        <div className="leading-tight">
                          <div style={{ color: theme.colors.accentYellow }} className="font-bold font-mono text-sm">
                            {building.quantity}×
                          </div>
                          <div style={{ color: theme.colors.textPrimary }} className="text-sm truncate opacity-90">
                            {building.name}
                          </div>
                        </div>
                      </div>

                      {/* Right: Inline Materials */}
                      <div className="flex-1 flex flex-wrap gap-x-4 gap-y-2 items-center">
                        {buildingMaterialEntries.map(([materialName, totalQuantity]) => {
                           const materialMapping = MATERIAL_MAPPINGS[materialName];
                           const spriteId = materialMapping?.id;
                           const materialSprite = spriteId ? getMaterialSprite(spriteId) : null;
                           const perUnitQuantity = (totalQuantity / building.quantity).toFixed(2);
                           const displayPerUnit = parseFloat(perUnitQuantity) === Math.round(parseFloat(perUnitQuantity)) ? Math.round(parseFloat(perUnitQuantity)).toString() : parseFloat(perUnitQuantity).toString();

                           return (
                             <div 
                               key={materialName} 
                               className="flex items-center gap-1.5"
                             >
                               <div className="w-6 h-6 rounded overflow-hidden bg-black/20">
                                 {materialSprite && <Sprite sprite={materialSprite} alt={materialMapping?.name || materialName} className="w-full h-full" size={0.38} />}
                               </div>
                               <div className="flex flex-col">
                                 <div className="flex items-baseline gap-1">
                                   <span style={{ color: theme.colors.accentYellow }} className="font-bold text-sm">
                                     {totalQuantity}
                                   </span>
                                   <span style={{ color: theme.colors.textSecondary }} className="text-xs opacity-75">
                                     {materialMapping?.name || materialName}
                                   </span>
                                 </div>
                                 {!hidePerUnit && (
                                   <span style={{ color: theme.colors.textSecondary }} className="text-xs opacity-60">
                                     {displayPerUnit} per unit
                                   </span>
                                 )}
                               </div>
                             </div>
                           );
                        })}
                      </div>
                    </div>
                  );
                }

                // --- CARD VIEW ---
                return (
                  <div
                    key={building.id}
                    style={{
                      borderColor: theme.colors.cardBorder,
                      backgroundColor: `${theme.colors.cardBg}40`
                    }}
                    className="rounded-lg border overflow-hidden shadow-sm"
                  >
                    <div 
                      className="px-3 py-2 flex items-center gap-3 border-b border-white/5" 
                      style={{ backgroundColor: 'rgba(0, 0, 0, 0.12)' }}
                    >
                      <div className="rounded flex items-center justify-center overflow-hidden w-14 h-14 flex-shrink-0">
                        {sprite ? (
                          <Sprite sprite={sprite} alt={building.name} className="w-full h-full" />
                        ) : building.icon ? (
                          <img src={building.icon} alt={building.name} className="w-full h-full object-cover" />
                        ) : (
                          <span style={{ color: theme.colors.textSecondary }} className="text-xs">?</span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0 flex items-baseline gap-2">
                         <span style={{ color: theme.colors.accentYellow }} className="font-bold font-mono text-lg">
                          {building.quantity}×
                        </span>
                        <span style={{ color: theme.colors.textPrimary }} className="font-bold text-base truncate opacity-90">
                           {building.name}
                        </span>
                      </div>
                    </div>
                    
                    {buildingMaterialEntries.length > 0 ? (
                      <div className="p-2 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                        {buildingMaterialEntries.map(([materialName, totalQuantity]) => {
                          const materialMapping = MATERIAL_MAPPINGS[materialName];
                          const spriteId = materialMapping?.id;
                          const materialSprite = spriteId ? getMaterialSprite(spriteId) : null;
                          const material = materials.find(m => m.name === materialMapping?.name);
                          const perUnitQuantity = (totalQuantity / building.quantity).toFixed(2);
                          const displayPerUnit = parseFloat(perUnitQuantity) === Math.round(parseFloat(perUnitQuantity)) ? Math.round(parseFloat(perUnitQuantity)).toString() : parseFloat(perUnitQuantity).toString();
                          
                          return (
                            <div
                              key={`${building.id}-${materialName}`}
                              style={{ backgroundColor: 'rgba(255, 255, 255, 0.05)' }}
                              className="rounded p-2 flex items-center gap-3 transition hover:bg-white/10"
                            >
                              <div className="flex-shrink-0 w-10 h-10 rounded flex items-center justify-center overflow-hidden">
                                {materialSprite ? (
                                  <Sprite sprite={materialSprite} alt={materialMapping?.name} className="w-full h-full" />
                                ) : material?.icon ? (
                                  <img src={material.icon} alt={materialMapping?.name} className="w-full h-full object-cover" />
                                ) : (
                                  <span style={{ color: theme.colors.textSecondary }} className="text-xs">?</span>
                                )}
                              </div>
                              <div className="flex-1 min-w-0 flex flex-col justify-center">
                                <div className="flex items-baseline gap-1.5 truncate">
                                  <span style={{ color: theme.colors.accentYellow }} className="font-bold text-base leading-none">
                                    {totalQuantity}
                                  </span>
                                  <span style={{ color: theme.colors.textPrimary }} className="text-xs font-medium truncate opacity-90">
                                    {materialMapping?.name || materialName}
                                  </span>
                                </div>
                                {!hidePerUnit && (
                                  <div style={{ color: theme.colors.textSecondary }} className="text-[12px] opacity-80 font-mono mt-0.5">
                                    {displayPerUnit} / unit
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div style={{ color: theme.colors.textSecondary }} className="text-xs italic p-3 opacity-50">
                        No material data
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
});

export default BlueprintStats;
