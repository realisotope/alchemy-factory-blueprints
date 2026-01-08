import { X } from "lucide-react";
import { useTheme } from "../lib/ThemeContext";
import BlueprintUpload from "./BlueprintUpload";

export default function UploadModal({ isOpen, onClose, user, onUploadSuccess }) {
  const { theme } = useTheme();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div
        style={{
          backgroundColor: theme.colors.elementBg,
          backgroundImage: `linear-gradient(to bottom, ${theme.colors.elementBg}, ${theme.colors.elementBgCard})`,
          borderColor: theme.colors.elementBorder,
        }}
        className="rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto border-2"
      >
        {/* Header */}
        <div
          style={{
            background: `linear-gradient(to right, ${theme.colors.headerGradientFrom}, ${theme.colors.headerGradientVia}, ${theme.colors.headerGradientTo})`,
          }}
          className="sticky top-0 text-white p-6 flex items-center justify-between"
        >
          <span className="text-2xl flex-shrink-0">✨</span>
          <h2
            style={{
              backgroundImage: `linear-gradient(to right, ${theme.colors.accentYellow}, ${theme.colors.accentLighter})`,
            }}
            className="text-2xl font-bold bg-clip-text text-transparent flex-1"
          >
            Upload Blueprint
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg transition"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-8">
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
