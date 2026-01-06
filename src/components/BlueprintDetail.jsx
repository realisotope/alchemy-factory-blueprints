import { X, Download, Heart, Calendar, User, Maximize2, Share2, Check, Edit2, ChevronDown } from "lucide-react";
import { useState, useEffect } from "react";
import { stripDiscordDiscriminator } from "../lib/discordUtils";
import { sanitizeCreatorName } from "../lib/sanitization";
import { updateBlueprintMetaTags, resetMetaTags } from "../lib/metaTags";
import { getDetailViewUrl, getLightboxUrl } from "../lib/imageOptimization";
import EditBlueprint from "./EditBlueprint";
import BlueprintStats from "./BlueprintStats";

export default function BlueprintDetail({ blueprint, isOpen, onClose, user, onLikeChange, onSearchByCreator, onBlueprintUpdate, onDownload, userLikes = new Set() }) {
  const [isLiked, setIsLiked] = useState(userLikes.has(blueprint?.id));
  const [likeCount, setLikeCount] = useState(blueprint?.likes ?? 0);
  const [downloadCount, setDownloadCount] = useState(blueprint?.downloads ?? 0);
  const [isImageExpanded, setIsImageExpanded] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [showScrollIndicator, setShowScrollIndicator] = useState(false);
  const [scrollableRef, setScrollableRef] = useState(null);

  useEffect(() => {
    console.log(`BlueprintDetail mounted/updated for ${blueprint?.id}: likes=${blueprint?.likes}, downloads=${blueprint?.downloads}`);
    setLikeCount(blueprint?.likes ?? 0);
    setDownloadCount(blueprint?.downloads ?? 0);
    setIsLiked(userLikes.has(blueprint?.id));
  }, [blueprint?.id, blueprint?.likes, blueprint?.downloads, userLikes]);

  // Update meta tags when blueprint is opened/closed
  useEffect(() => {
    if (isOpen && blueprint) {
      updateBlueprintMetaTags(blueprint);
    } else {
      resetMetaTags();
    }

    return () => {
      resetMetaTags();
    };
  }, [isOpen, blueprint]);

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

  // Check for scrollable content
  useEffect(() => {
    const checkScroll = () => {
      if (scrollableRef) {
        const hasScroll = scrollableRef.scrollHeight > scrollableRef.clientHeight;
        const isNotAtBottom = scrollableRef.scrollTop + scrollableRef.clientHeight < scrollableRef.scrollHeight - 10;
        setShowScrollIndicator(hasScroll && isNotAtBottom);
      }
    };

    checkScroll();
    
    if (scrollableRef) {
      scrollableRef.addEventListener("scroll", checkScroll);
      window.addEventListener("resize", checkScroll);
      return () => {
        scrollableRef.removeEventListener("scroll", checkScroll);
        window.removeEventListener("resize", checkScroll);
      };
    }
  }, [scrollableRef, isOpen]);

  if (!isOpen || !blueprint) return null;

  const handleLike = async () => {
    if (!user) {
      alert("Please login to like blueprints");
      return;
    }
    
    const currentlyLiked = isLiked;
    onLikeChange?.(!currentlyLiked);
    setIsLiked(!currentlyLiked);
    setLikeCount(currentlyLiked ? likeCount - 1 : likeCount + 1);
  };

  const handleDownloadClick = async () => {
    onDownload?.(blueprint);
    
    setDownloadCount(downloadCount + 1);
    
    const a = document.createElement("a");
    a.href = blueprint.file_url;
    a.download = blueprint.title;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
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
      <div ref={setScrollableRef} className="bg-gradient-to-b from-[#b99a77] to-[#876e54] border-2 border-[#cfb153] rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto relative" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="sticky top-0 z-10 bg-gradient-to-r from-[#a78158] via-[#9f7f5a] to-[#9b7956] text-white p-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold bg-gradient-to-r from-[#fcd34d] to-[#fde047] bg-clip-text text-transparent flex-1 truncate">{blueprint.title}</h2>
          <button
            onClick={onClose}
            className="ml-4 p-2 hover:bg-white/10 rounded-lg transition"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-3">
          {/* Image */}
          {blueprint.image_url && (
            <div className="relative group">
              <img
                src={getDetailViewUrl(blueprint.image_url)}
                alt={blueprint.title}
                className="w-full h-48 sm:h-96 object-cover rounded-lg cursor-pointer transition hover:shadow-lg hover:shadow-[#6b5d45]/70"
                onClick={() => setIsImageExpanded(true)}
                loading="lazy"
              />
              <button
                onClick={() => setIsImageExpanded(true)}
                className="absolute top-3 right-3 bg-black/60 hover:bg-black/80 text-[#ffdca7] p-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                title="Expand image"
              >
                <Maximize2 className="w-5 h-5" />
              </button>
            </div>
          )}

          {/* Stats and Creator Row*/}
          <div className="flex flex-col lg:flex-row gap-2 items-stretch">
            {/* Stats Grid */}
            <div className="grid grid-cols-3 gap-2 lg:flex-1">
              <div className="bg-[#8e704e] p-2 rounded-lg border-2 border-[#bba664] shadow-lg text-center">
                <div className="text-base font-bold text-[#fcd34d]">{downloadCount}</div>
                <div className="text-xs text-[#ffe797] flex items-center justify-center mt-0.5">
                  <Download className="w-3 h-3 mr-0.5" />
                  Downloads
                </div>
              </div>
              <div className="bg-[#8e704e] p-2 rounded-lg border-2 border-[#bba664] shadow-lg text-center">
                <div className="text-base font-bold text-rose-400">{likeCount}</div>
                <div className="text-xs text-[#ffe797] flex items-center justify-center mt-0.5">
                  <Heart className="w-3 h-3 mr-0.5" />
                  Likes
                </div>
              </div>
              <div className="bg-[#8e704e] p-2 rounded-lg border-2 border-[#bba664] shadow-lg text-center">
                <div className="text-base font-bold text-blue-300">
                  {new Date(blueprint.created_at).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}
                </div>
                <div className="text-xs text-[#ffe797] flex items-center justify-center mt-0.5">
                  <Calendar className="w-3 h-3 mr-0.5" />
                  Uploaded
                </div>
              </div>
            </div>

            {/* Creator Info */}
            <div className="bg-gradient-to-r from-[#634116]/30 to-[#9f722e]/30 p-2 rounded-lg border-2 border-[#bba664]/90 shadow-lg lg:flex-1">
              <div className="flex items-center gap-2 h-full">
                <User className="w-4 h-4 text-[#fcd34d] flex-shrink-0" />
                <div className="min-w-0">
                  <p className="font-semibold text-xs text-[#ffdca7]">Creator</p>
                  <button
                    onClick={handleCreatorClick}
                    className="font-semibold text-[#fcd34d] hover:text-[#ffdca7]/80 hover:underline transition cursor-pointer text-sm"
                  >
                    {sanitizeCreatorName(stripDiscordDiscriminator(blueprint.creator_name))}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Description */}
          {blueprint.description && (
            <div>
              <h3 className="text-lg font-bold text-[#fcd34d] mb-2">Description</h3>
              <p className="text-[#fbe5c2] leading-relaxed whitespace-pre-wrap break-words">
                {blueprint.description}
              </p>
            </div>
          )}

          {/* Blueprint Stats - Materials and Buildings */}
          <BlueprintStats 
            key={`${blueprint.id}-stats`}
            materials={blueprint.materials || []} 
            buildings={blueprint.buildings || []} 
          />

          {/* Tags */}
          {blueprint.tags && blueprint.tags.length > 0 && (
            <div>
              <h3 className="text-lg font-bold text-amber-300 mb-3">Tags</h3>
              <div className="flex flex-wrap gap-2">
                {blueprint.tags.map((tag) => (
                  <span
                    key={tag}
                    className="bg-[#6f5a43]/50 text-[#ffdca7] px-3 py-1 rounded-full text-sm font-medium border border-[#6b5d45]/30 shadow"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Changelog
          {blueprint.changelog && (
            <div>
              <h3 className="text-lg font-bold text-[#ffdca7] mb-2">What's Changed</h3>
              <p className="text-[#bba664] leading-relaxed whitespace-pre-wrap break-words">
                {blueprint.changelog}
              </p>
            </div>
          )} */}

          {/* Date Info */}
          <div className="text-sm text-[#ffe1b2] pt-4 border-t border-[#d3b593] space-y-1">
            {blueprint.updated_at && blueprint.updated_at !== blueprint.created_at && (
              <div>
                Updated on{" "}
                {new Date(blueprint.updated_at).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </div>
            )}
            <div>
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
        </div>

        {/* Footer Actions */}
        <div className="sticky bottom-0 bg-gradient-to-t from-[#a78158] via-[#9f7f5a] to-[#9b7956] p-3 sm:p-6 flex gap-2 sm:gap-3 border-t-2 border-[#87725a]/50 flex-wrap relative">
          {/* Scroll Indicator */}
          {showScrollIndicator && (
            <button
              onClick={() => {
                if (scrollableRef) {
                  scrollableRef.scrollTo({ top: scrollableRef.scrollHeight, behavior: 'smooth' });
                }
              }}
              className="absolute animate-bounce hover:opacity-80 transition cursor-pointer"
              style={{ left: 'calc(50% - 18px)', top: '-22px', transform: 'translateX(-50%)' }}
              title="Scroll down"
            >
              <div className="w-10 h-10 rounded-full border-2 border-[#bba664] flex items-center justify-center bg-[#a38654]/90">
                <ChevronDown className="w-5 h-5 text-[#ffdca7]" />
              </div>
            </button>
          )}
          <button
            onClick={handleDownloadClick}
            className="flex-1 min-w-0 bg-gradient-to-r from-[#5b4a39]/50 to-[#59452e]/50 hover:from-[#dbb84a] hover:to-[#fbcd32] text-[#ffdca7] hover:text-white py-2 sm:py-3 rounded-lg font-semibold transition flex items-center justify-center gap-1 sm:gap-2 text-sm sm:text-base"
          >
            <Download className="w-4 h-4 sm:w-5 sm:h-5" />
            <span className="hidden sm:inline">Download</span>
            <span className="sm:hidden">Download</span>
          </button>
          <button
            onClick={handleLike}
            className={`flex-1 min-w-0 flex items-center justify-center gap-1 sm:gap-2 py-2 sm:py-3 rounded-lg font-semibold transition text-sm sm:text-base ${
              isLiked
                ? "bg-[#c59c68] hover:bg-[#fbcd32] text-red"
                : "bg-[#c59c68] hover:bg-[#fbcd32] text-[#ffdca7] hover:text-red-500"
            }`}
          >
            <Heart className={`w-4 h-4 sm:w-5 sm:h-5 hidden sm:inline ${isLiked ? "fill-current" : ""}`} />
            <span className="hidden sm:inline">{isLiked ? "Liked" : "Like"}</span>
            <span className="sm:hidden">{isLiked ? "❤️" : "🤍"}</span>
          </button>
          <button
            onClick={handleShareBlueprint}
            className={`flex-1 min-w-0 py-2 sm:py-3 rounded-lg font-semibold transition flex items-center justify-center gap-1 sm:gap-2 text-sm sm:text-base ${
              copyFeedback
                ? "bg-[#af9170] text-[#ffdca7]"
                : "bg-[#af9170] hover:bg-[#fbcd32] text-[#ffdca7] hover:text-blue-500"
            }`}
            title="Copy blueprint link to clipboard"
          >
            {copyFeedback ? (
              <>
                <Check className="w-4 h-4 sm:w-5 sm:h-5" />
                <span className="hidden sm:inline">Copied!</span>
              </>
            ) : (
              <>
                <Share2 className="w-4 h-4 sm:w-5 sm:h-5" />
                <span className="hidden sm:inline">Share</span>
              </>
            )}
          </button>
          {user && user.id === blueprint.user_id && (
            <button
              onClick={() => setIsEditOpen(true)}
              className="px-2 sm:px-4 py-2 sm:py-3 rounded-lg font-semibold transition flex items-center justify-center gap-1 sm:gap-2 bg-[#59452e]/60 hover:bg-[#fbcd32] text-[#ffdca7] hover:text-red-500 text-sm sm:text-base"
              title="Edit this blueprint"
            >
              <Edit2 className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="hidden sm:inline">Edit</span>
            </button>
          )}
        </div>
      </div>

      {/* Edit Blueprint Modal */}
      <EditBlueprint
        blueprint={blueprint}
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        user={user}
        onUpdate={() => {
          setIsEditOpen(false);
          onBlueprintUpdate?.();
        }}
      />

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
                src={getLightboxUrl(blueprint.image_url)}
                alt={blueprint.title}
                className="max-w-full max-h-full object-contain rounded-lg"
                loading="lazy"
              />
              <button
                onClick={() => setIsImageExpanded(false)}
                className="absolute -top-12 right-0 p-2 hover:bg-white/10 rounded-lg transition text-white"
                title="Close"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <p className="absolute bottom-4 left-1/2 transform -translate-x-1/2 text-[#bba664] text-sm">
              Click to close or press Escape
            </p>
          </div>
        </div>
      )}
    </div>
  );
}