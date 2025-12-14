import { X, Download, Heart, Calendar, User, Maximize2, Share2, Check } from "lucide-react";
import { useState, useEffect } from "react";
import { stripDiscordDiscriminator } from "../lib/discordUtils";
import { sanitizeCreatorName } from "../lib/sanitization";

export default function BlueprintDetail({ blueprint, isOpen, onClose, user, onLikeChange, onSearchByCreator }) {
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(blueprint?.likes || 0);
  const [isImageExpanded, setIsImageExpanded] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState(false);

  useEffect(() => {
    setLikeCount(blueprint?.likes || 0);
  }, [blueprint?.likes]);

  // Handle Escape key to close expanded image
  useEffect(() => {
    const handleEscapeKey = (e) => {
      if (e.key === "Escape" && isImageExpanded) {
        setIsImageExpanded(false);
      }
    };

    window.addEventListener("keydown", handleEscapeKey);
    return () => window.removeEventListener("keydown", handleEscapeKey);
  }, [isImageExpanded]);

  if (!isOpen || !blueprint) return null;

  const handleLike = async () => {
    if (!user) {
      alert("Please login to like blueprints");
      return;
    }
    
    onLikeChange?.(!isLiked);
    setIsLiked(!isLiked);
    setLikeCount(isLiked ? likeCount - 1 : likeCount + 1);
  };

  const handleShareBlueprint = () => {
    const blueprintUrl = `${window.location.origin}?blueprintId=${blueprint.id}`;
    navigator.clipboard.writeText(blueprintUrl).then(() => {
      setCopyFeedback(true);
      setTimeout(() => setCopyFeedback(false), 2000);
    });
  };

  const handleCreatorClick = () => {
    if (onSearchByCreator) {
      onSearchByCreator(blueprint.creator_name);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-gradient-to-b from-gray-900 to-gray-950 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto border-2 border-cyan-700/50" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-blue-900 via-cyan-900 to-blue-900 text-white p-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-amber-300 flex-1 truncate">{blueprint.title}</h2>
          <button
            onClick={onClose}
            className="ml-4 p-2 hover:bg-white/10 rounded-lg transition"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Image */}
          {blueprint.image_url && (
            <div className="relative group">
              <img
                src={blueprint.image_url}
                alt={blueprint.title}
                className="w-full h-64 object-cover rounded-lg border-2 border-cyan-700/50 cursor-pointer transition hover:border-cyan-500/70 hover:shadow-lg hover:shadow-cyan-900/50"
                onClick={() => setIsImageExpanded(true)}
                loading="lazy"
              />
              <button
                onClick={() => setIsImageExpanded(true)}
                className="absolute top-3 right-3 bg-black/60 hover:bg-black/80 text-amber-300 p-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                title="Expand image"
              >
                <Maximize2 className="w-5 h-5" />
              </button>
            </div>
          )}

          {/* Stats Row */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-blue-900/30 p-4 rounded-lg border-2 border-cyan-700/50 text-center">
              <div className="text-2xl font-bold text-amber-300">{blueprint.downloads || 0}</div>
              <div className="text-sm text-gray-400 flex items-center justify-center mt-1">
                <Download className="w-4 h-4 mr-1" />
                Downloads
              </div>
            </div>
            <div className="bg-blue-900/30 p-4 rounded-lg border-2 border-cyan-700/50 text-center">
              <div className="text-2xl font-bold text-rose-400">{likeCount}</div>
              <div className="text-sm text-gray-400 flex items-center justify-center mt-1">
                <Heart className="w-4 h-4 mr-1" />
                Likes
              </div>
            </div>
            <div className="bg-blue-900/30 p-4 rounded-lg border-2 border-cyan-700/50 text-center">
              <div className="text-lg font-bold text-blue-300">
                {new Date(blueprint.created_at).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })}
              </div>
              <div className="text-sm text-gray-400 flex items-center justify-center mt-1">
                <Calendar className="w-4 h-4 mr-1" />
                Uploaded
              </div>
            </div>
          </div>

          {/* Creator Info */}
          <div className="bg-gradient-to-r from-cyan-900/30 to-blue-900/30 p-4 rounded-lg border-2 border-cyan-700/50">
            <div className="flex items-center gap-3">
              <User className="w-5 h-5 text-amber-400" />
              <div>
                <p className="text-sm text-gray-400">Creator</p>
                <button
                  onClick={handleCreatorClick}
                  className="font-semibold text-amber-300 hover:text-amber-200 hover:underline transition cursor-pointer"
                >
                  {sanitizeCreatorName(stripDiscordDiscriminator(blueprint.creator_name))}
                </button>
              </div>
            </div>
          </div>

          {/* Description */}
          {blueprint.description && (
            <div>
              <h3 className="text-lg font-bold text-amber-300 mb-2">Description</h3>
              <p className="text-gray-300 leading-relaxed whitespace-pre-wrap break-words">
                {blueprint.description}
              </p>
            </div>
          )}

          {/* Tags */}
          {blueprint.tags && blueprint.tags.length > 0 && (
            <div>
              <h3 className="text-lg font-bold text-amber-300 mb-3">Tags</h3>
              <div className="flex flex-wrap gap-2">
                {blueprint.tags.map((tag) => (
                  <span
                    key={tag}
                    className="bg-cyan-700/50 text-cyan-200 px-3 py-1 rounded-full text-sm font-medium border border-cyan-600/50"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Upload Date */}
          <div className="text-sm text-gray-500 pt-4 border-t border-gray-800">
            Uploaded on{" "}
            {new Date(blueprint.created_at).toLocaleDateString("en-US", {
              year: "numeric",
              month: "long",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="sticky bottom-0 bg-gradient-to-t from-gray-950 to-gray-900 p-6 flex gap-3">
          <a
            href={blueprint.file_url}
            download
            className="flex-1 bg-gradient-to-r from-amber-600 to-yellow-600 hover:from-amber-500 hover:to-yellow-500 text-black py-3 rounded-lg font-semibold transition flex items-center justify-center gap-2"
          >
            <Download className="w-5 h-5" />
            Download
          </a>
          <button
            onClick={handleLike}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg font-semibold transition ${
              isLiked
                ? "bg-rose-700 hover:bg-rose-600 text-white"
                : "bg-gray-700 hover:bg-gray-600 text-gray-200"
            }`}
          >
            <Heart className={`w-5 h-5 ${isLiked ? "fill-current" : ""}`} />
            {isLiked ? "Liked" : "Like"}
          </button>
          <button
            onClick={handleShareBlueprint}
            className={`px-4 py-3 rounded-lg font-semibold transition flex items-center justify-center gap-2 ${
              copyFeedback
                ? "bg-green-700 text-white"
                : "bg-cyan-700 hover:bg-cyan-600 text-white"
            }`}
            title="Copy blueprint link to clipboard"
          >
            {copyFeedback ? (
              <>
                <Check className="w-5 h-5" />
                Copied!
              </>
            ) : (
              <>
                <Share2 className="w-5 h-5" />
                Share
              </>
            )}
          </button>
        </div>
      </div>

      {/* Image Lightbox */}
      {isImageExpanded && blueprint.image_url && (
        <div 
          className="fixed inset-0 bg-black/90 z-[60] flex items-center justify-center p-4 backdrop-blur-sm"
          onClick={() => setIsImageExpanded(false)}
        >
          <div 
            className="relative max-w-4xl max-h-[90vh] w-full h-full flex items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative">
              <img
                src={blueprint.image_url}
                alt={blueprint.title}
                className="max-w-full max-h-full object-contain rounded-lg"
              />
              <button
                onClick={() => setIsImageExpanded(false)}
                className="absolute -top-12 right-0 p-2 hover:bg-white/10 rounded-lg transition text-white"
                title="Close"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <p className="absolute bottom-4 left-1/2 transform -translate-x-1/2 text-gray-300 text-sm">
              Click to close or press Escape
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
