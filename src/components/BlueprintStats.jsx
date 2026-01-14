import { ChevronDown } from "lucide-react";
import { useState, memo } from "react";
import { useTheme } from "../lib/ThemeContext";
import Sprite from "./Sprite";
import { getMaterialSprite, getBuildingSprite } from "../lib/spriteData";

const BlueprintStats = memo(function BlueprintStats({ 
  materials = [], 
  buildings = [],
  minTier,
  inventorySlots,
  gridSize
}) {
  const { theme } = useTheme();
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState("materials"); // "materials" or "buildings"

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
        </div>
      </div>

      {/* Metadata badges */}
      {(minTier !== undefined || inventorySlots !== undefined || gridSize) && (
        <div 
          style={{ 
            backgroundImage: `linear-gradient(to right, ${theme.colors.gradientFrom}10, ${theme.colors.gradientTo}10)`,
            borderTopColor: theme.colors.cardBorder 
          }}
          className="border-t-2 px-3 py-3 flex justify-around items-center"
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
        </div>
      )}

      {/* Content */}
      {isExpanded && (
        <div style={{ backgroundImage: `linear-gradient(to right, ${theme.colors.gradientFrom}10, ${theme.colors.gradientTo}10)` }} className="p-3">
          <div className="grid grid-cols-4 sm:grid-cols-5 lg:grid-cols-7 gap-1.5">
            {activeTab === "materials" ? (
              materials.map((material) => {
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
              })
            ) : (
              buildings.map((building) => {
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
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
});

export default BlueprintStats;
