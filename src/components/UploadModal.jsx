import { X } from "lucide-react";
import BlueprintUpload from "./BlueprintUpload";

export default function UploadModal({ isOpen, onClose, user, onUploadSuccess }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-gradient-to-b from-gray-900 to-gray-950 rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto border-2 border-cyan-700/50">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-blue-900 via-cyan-900 to-blue-900 text-white p-6 flex items-center justify-between border-b border-cyan-700">
          <h2 className="text-2xl font-bold bg-gradient-to-r from-amber-300 to-yellow-300 bg-clip-text text-transparent">
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
