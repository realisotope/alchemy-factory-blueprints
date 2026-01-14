import { X } from "lucide-react";
import { useTheme } from "../lib/ThemeContext";
import BlueprintUpload from "./BlueprintUpload";

export default function UploadModal({ isOpen, onClose, user, onUploadSuccess }) {
  const { theme } = useTheme();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-start justify-center backdrop-blur-sm pt-20 pb-6 px-4">
      <div
        style={{
          backgroundColor: theme.colors.elementBg,
          backgroundImage: `linear-gradient(to bottom, ${theme.colors.elementBg}, ${theme.colors.elementBgCard})`,
          borderColor: theme.colors.elementBorder,
        }}
        className="rounded-lg w-full max-w-2xl max-h-[calc(100vh-10rem)] overflow-hidden flex flex-col border-2"
      >
        {/* Header */}
        <div
          style={{
            background: `linear-gradient(to right, ${theme.colors.headerGradientFrom}, ${theme.colors.headerGradientVia}, ${theme.colors.headerGradientTo})`,
          }}
          className="flex-shrink-0 text-white px-4 py-4 md:px-6 md:py-5 flex items-center justify-between"
        >
          <span className="text-xl md:text-2xl flex-shrink-0">✨</span>
          <h2
            style={{
              backgroundImage: `linear-gradient(to right, ${theme.colors.accentYellow}, ${theme.colors.accentLighter})`,
            }}
            className="text-xl md:text-2xl font-bold bg-clip-text text-transparent flex-1"
          >
            Upload Blueprint
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 md:p-2 hover:bg-white/10 rounded-lg transition"
          >
            <X className="w-5 h-5 md:w-6 md:h-6" />
          </button>
        </div>

        {/* Content - Scrollable */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          <BlueprintUpload
            user={user}
            onUploadSuccess={() => {
              onUploadSuccess?.();
              onClose();
            }}
          />
        </div>
      </div>
    </div>
  );
}
