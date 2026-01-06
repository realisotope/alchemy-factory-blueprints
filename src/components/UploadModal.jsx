import { X } from "lucide-react";
import BlueprintUpload from "./BlueprintUpload";

export default function UploadModal({ isOpen, onClose, user, onUploadSuccess }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-gradient-to-b from-[#b99a77] to-[#876e54] rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto border-2 border-[#87725a]/50">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-[#a78158] via-[#9f7f5a] to-[#9b7956] text-white p-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-[#fcd34d] bg-clip-text flex-1">
            ✨ Upload Blueprint
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
