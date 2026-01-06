import { ChevronDown } from "lucide-react";
import { useState, memo } from "react";

const BlueprintStats = memo(function BlueprintStats({ materials = [], buildings = [] }) {
  const [expandedSection, setExpandedSection] = useState(null);

  const toggleSection = (section) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  if (!materials.length && !buildings.length) {
    return null;
  }

  return (
    <div className="space-y-2">
      {/* Materials Section */}
      {materials.length > 0 && (
        <div className="border-2 border-[#bba664] rounded-lg overflow-hidden">
          <button
            onClick={() => toggleSection("materials")}
            className="w-full bg-gradient-to-r from-[#634116]/30 to-[#9f722e]/30 hover:from-[#634116]/60 hover:to-[#9f722e]/60 shadow-lg p-3 flex items-center justify-between transition"
          >
            <h3 className="text-lg font-bold text-amber-300">Materials</h3>
            <ChevronDown
              className={`w-5 h-5 text-[#ffdca7] transition-transform ${
                expandedSection === "materials" ? "rotate-180" : ""
              }`}
            />
          </button>
          {expandedSection === "materials" && (
            <div className="bg-[#f7c995]/20 p-4">
              <div className="grid grid-cols-4 sm:grid-cols-5 lg:grid-cols-7 gap-2">
                {materials.map((material) => (
                  <div
                    key={material.id}
                    className="bg-[#634116]/30 rounded-lg border-2 border-[#87725a] shadow-lg p-2 text-center transition"
                    title={material.name}
                  >
                    <div className="aspect-square rounded flex items-center justify-center mb-2 overflow-hidden">
                      {material.icon ? (
                        <img
                          src={material.icon}
                          alt={material.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-[#6b5d45] text-xs">No icon</span>
                      )}
                    </div>
                    <div className="text-sm font-bold text-amber-300">
                      {material.quantity}
                    </div>
                    <div className="text-xs truncate">
                      {material.name}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Buildings Section */}
      {buildings.length > 0 && (
        <div className="border-2 border-[#bba664] rounded-lg overflow-hidden">
          <button
            onClick={() => toggleSection("buildings")}
            className="w-full bg-gradient-to-r from-[#634116]/30 to-[#9f722e]/30 hover:from-[#634116]/60 hover:to-[#9f722e]/60 p-3 flex items-center justify-between transition"
          >
            <h3 className="text-lg font-bold text-amber-300">Buildings</h3>
            <ChevronDown
              className={`w-5 h-5 text-[#ffdca7] transition-transform ${
                expandedSection === "buildings" ? "rotate-180" : ""
              }`}
            />
          </button>
          {expandedSection === "buildings" && (
            <div className="bg-[#f7c995]/20 p-4">
              <div className="grid grid-cols-4 sm:grid-cols-5 lg:grid-cols-7 gap-2">
                {buildings.map((building) => (
                  <div
                    key={building.id}
                    className="bg-[#593e21]/30 rounded-lg border-2 border-[#87725a] p-2 text-center hover:border-[#af9170]/70 transition"
                    title={building.name}
                  >
                    <div className="aspect-square rounded flex items-center justify-center mb-2 overflow-hidden">
                      {building.icon ? (
                        <img
                          src={building.icon}
                          alt={building.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-[#6b5d45] text-xs">No icon</span>
                      )}
                    </div>
                    <div className="text-sm font-bold text-amber-300">
                      {building.quantity}
                    </div>
                    <div className="text-xs truncate">
                      {building.name}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
});

export default BlueprintStats;
