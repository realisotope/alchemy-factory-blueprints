import { ChevronDown } from "lucide-react";
import { useState, memo } from "react";
import { useTheme } from "../lib/ThemeContext";
import Sprite from "./Sprite";
import { getMaterialSprite, getBuildingSprite } from "../lib/spriteData";

const BlueprintStats = memo(function BlueprintStats({ materials = [], buildings = [] }) {
  const { theme } = useTheme();
  const [expandedMaterials, setExpandedMaterials] = useState(false);
  const [expandedBuildings, setExpandedBuildings] = useState(false);

  if (!materials.length && !buildings.length) {
    return null;
  }

  return (
    <div className="space-y-2">
      {/* Materials Section */}
      {materials.length > 0 && (
        <div style={{ borderColor: theme.colors.cardBorder }} className="border-2 rounded-lg overflow-hidden">
          <button
            onClick={() => setExpandedMaterials(!expandedMaterials)}
            style={{
              backgroundImage: `linear-gradient(to right, ${theme.colors.gradientFrom}30, ${theme.colors.gradientTo}30)`,
            }}
            className="w-full hover:opacity-80 shadow-lg p-3 flex items-center justify-between transition" onMouseEnter={(e) => e.currentTarget.style.backgroundImage = `linear-gradient(to right, ${theme.colors.gradientFrom}60, ${theme.colors.gradientTo}60)`} onMouseLeave={(e) => e.currentTarget.style.backgroundImage = `linear-gradient(to right, ${theme.colors.gradientFrom}30, ${theme.colors.gradientTo}30)`}
          >
            <h3 style={{ color: theme.colors.accentYellow }} className="text-lg font-bold">Materials</h3>
            <ChevronDown
              style={{ color: theme.colors.textPrimary }}
              className={`w-5 h-5 transition-transform ${
                expandedMaterials ? "rotate-180" : ""
              }`}
            />
          </button>
          {expandedMaterials && (
            <div style={{ backgroundImage: `linear-gradient(to right, ${theme.colors.gradientFrom}10, ${theme.colors.gradientTo}10)` }} className="p-4">
              <div className="grid grid-cols-4 sm:grid-cols-5 lg:grid-cols-7 gap-2">
                {materials.map((material) => {
                  const sprite = getMaterialSprite(material.id);
                  return (
                    <div
                      key={material.id}
                      style={{
                        backgroundImage: `linear-gradient(to right, ${theme.colors.gradientFrom}30, ${theme.colors.gradientTo}30)`,
                        borderColor: theme.colors.cardBorder,
                      }}
                      className="rounded-lg border-2 shadow-lg p-2 text-center transition hover:shadow-lg"
                    >
                      <div className="aspect-square rounded flex items-center justify-center overflow-hidden">
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
                      <div className="text-sm font-bold" style={{ color: theme.colors.accentYellow }}>
                        {material.quantity}
                      </div>
                      <div style={{ color: theme.colors.textSecondary }} className="text-xs truncate">
                        {material.name}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Buildings Section */}
      {buildings.length > 0 && (
        <div style={{ borderColor: theme.colors.cardBorder }} className="border-2 rounded-lg overflow-hidden">
          <button
            onClick={() => setExpandedBuildings(!expandedBuildings)}
            style={{
              backgroundImage: `linear-gradient(to right, ${theme.colors.gradientFrom}30, ${theme.colors.gradientTo}30)`,
            }}
            className="w-full hover:opacity-80 p-3 flex items-center justify-between transition" onMouseEnter={(e) => e.currentTarget.style.backgroundImage = `linear-gradient(to right, ${theme.colors.gradientFrom}60, ${theme.colors.gradientTo}60)`} onMouseLeave={(e) => e.currentTarget.style.backgroundImage = `linear-gradient(to right, ${theme.colors.gradientFrom}30, ${theme.colors.gradientTo}30)`}
          >
            <h3 style={{ color: theme.colors.accentYellow }} className="text-lg font-bold">Buildings</h3>
            <ChevronDown
              style={{ color: theme.colors.textPrimary }}
              className={`w-5 h-5 transition-transform ${
                expandedBuildings ? "rotate-180" : ""
              }`}
            />
          </button>
          {expandedBuildings && (
            <div style={{ backgroundImage: `linear-gradient(to right, ${theme.colors.gradientFrom}10, ${theme.colors.gradientTo}10)` }} className="p-4">
              <div className="grid grid-cols-4 sm:grid-cols-5 lg:grid-cols-7 gap-2">
                {buildings.map((building) => {
                  const sprite = getBuildingSprite(building.id);
                  return (
                    <div
                      key={building.id}
                      style={{
                        backgroundImage: `linear-gradient(to right, ${theme.colors.gradientFrom}30, ${theme.colors.gradientTo}30)`,
                        borderColor: theme.colors.cardBorder,
                      }}
                      className="rounded-lg border-2 p-2 text-center transition hover:shadow-lg"
                    >
                      <div className="aspect-square rounded flex items-center justify-center mb-1 overflow-hidden">
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
                      <div style={{ color: theme.colors.accentYellow }} className="text-sm font-bold">
                        {building.quantity}
                      </div>
                      <div style={{ color: theme.colors.textSecondary }} className="text-xs truncate">
                        {building.name}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
});

export default BlueprintStats;
