import { X, Download, Heart, Calendar, User, Maximize2, Share2, Check, Edit2, ChevronDown } from "lucide-react";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { stripDiscordDiscriminator } from "../lib/discordUtils";
import { sanitizeCreatorName } from "../lib/sanitization";
import { updateBlueprintMetaTags, resetMetaTags } from "../lib/metaTags";
import { getDetailViewUrl, getLightboxUrl } from "../lib/imageOptimization";
import { parseUrlsInText } from "../lib/urlProcessor";
import { useTheme } from "../lib/ThemeContext";
import EditBlueprint from "./EditBlueprint";
import BlueprintStats from "./BlueprintStats";

export default function BlueprintDetail({ blueprint, isOpen, onClose, user, onLikeChange, onSearchByCreator, onBlueprintUpdate, onDownload, userLikes = new Set() }) {
  const { theme } = useTheme();
  const [isLiked, setIsLiked] = useState(userLikes.has(blueprint?.id));
  const [likeCount, setLikeCount] = useState(blueprint?.likes ?? 0);
  const [downloadCount, setDownloadCount] = useState(blueprint?.downloads ?? 0);
  const [isImageExpanded, setIsImageExpanded] = useState(false);
  const [imageError, setImageError] = useState(false);
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
  };

  const handleShareBlueprint = () => {
    // Use slug if available (human-readable URL), fall back to UUID
    const blueprintIdentifier = blueprint.slug || blueprint.id;
    const blueprintUrl = `${window.location.origin}/blueprint/${blueprintIdentifier}`;
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
    <AnimatePresence>
      {isOpen && blueprint && (
        <motion.div
          className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onClose}
        >
          <motion.div
            ref={setScrollableRef}
            style={{
              backgroundColor: theme.colors.elementBg,
              backgroundImage: `linear-gradient(to bottom, ${theme.colors.elementBg}, ${theme.colors.elementBgCard})`,
              borderColor: theme.colors.elementBorder,
            }}
            className="border-2 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto relative"
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.3, type: "spring", stiffness: 300, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
          >
        {/* Header */}
        <div style={{
          background: `linear-gradient(to right, ${theme.colors.headerGradientFrom}, ${theme.colors.headerGradientVia}, ${theme.colors.headerGradientTo})`,
        }} className="sticky top-0 z-10 text-white p-6 flex items-center justify-between">
          <h2 style={{
            backgroundImage: `linear-gradient(to right, ${theme.colors.accentYellow}, ${theme.colors.accentLighter})`,
          }} className="text-2xl font-bold bg-clip-text text-transparent flex-1 truncate">{blueprint.title}</h2>
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
          {blueprint.image_url && !imageError && (
            <div className="relative group">
              <img
                src={getDetailViewUrl(blueprint.image_url)}
                alt={blueprint.title}
                className="w-full h-48 sm:h-96 object-cover rounded-lg cursor-pointer transition hover:shadow-lg hover:shadow-black/30"
                onClick={() => setIsImageExpanded(true)}
                loading="lazy"
                onError={() => setImageError(true)}
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

          {/* Stats and Creator Row */}
          <div className="flex flex-col lg:flex-row gap-2 items-stretch">
            {/* Stats Grid */}
            <div className="grid grid-cols-3 gap-2 lg:flex-1">
              <div style={{
                backgroundImage: `linear-gradient(to right, ${theme.colors.gradientFrom}30, ${theme.colors.gradientTo}30)`,
                borderColor: theme.colors.cardBorder,
              }} className="p-2 rounded-lg border-2 shadow-lg text-center hover:shadow-xl transition" onMouseEnter={(e) => e.currentTarget.style.backgroundImage = `linear-gradient(to right, ${theme.colors.gradientFrom}60, ${theme.colors.gradientTo}60)`} onMouseLeave={(e) => e.currentTarget.style.backgroundImage = `linear-gradient(to right, ${theme.colors.gradientFrom}30, ${theme.colors.gradientTo}30)`}>
                <div style={{ color: theme.colors.accentYellow }} className="text-base font-bold">{downloadCount}</div>
                <div style={{ color: theme.colors.textSecondary }} className="text-xs flex items-center justify-center mt-0.5">
                  <Download className="w-3 h-3 mr-0.5" />
                  Downloads
                </div>
              </div>
              <div style={{
                backgroundImage: `linear-gradient(to right, ${theme.colors.gradientFrom}30, ${theme.colors.gradientTo}30)`,
                borderColor: theme.colors.cardBorder,
              }} className="p-2 rounded-lg border-2 shadow-lg text-center hover:shadow-xl transition" onMouseEnter={(e) => e.currentTarget.style.backgroundImage = `linear-gradient(to right, ${theme.colors.gradientFrom}60, ${theme.colors.gradientTo}60)`} onMouseLeave={(e) => e.currentTarget.style.backgroundImage = `linear-gradient(to right, ${theme.colors.gradientFrom}30, ${theme.colors.gradientTo}30)`}>
                <div className="text-base font-bold text-rose-400">{likeCount}</div>
                <div style={{ color: theme.colors.textSecondary }} className="text-xs flex items-center justify-center mt-0.5">
                  <Heart className="w-3 h-3 mr-0.5" />
                  Likes
                </div>
              </div>
              <div style={{
                backgroundImage: `linear-gradient(to right, ${theme.colors.gradientFrom}30, ${theme.colors.gradientTo}30)`,
                borderColor: theme.colors.cardBorder,
              }} className="p-2 rounded-lg border-2 shadow-lg text-center hover:shadow-xl transition" onMouseEnter={(e) => e.currentTarget.style.backgroundImage = `linear-gradient(to right, ${theme.colors.gradientFrom}60, ${theme.colors.gradientTo}60)`} onMouseLeave={(e) => e.currentTarget.style.backgroundImage = `linear-gradient(to right, ${theme.colors.gradientFrom}30, ${theme.colors.gradientTo}30)`}>
                <div className="text-base font-bold text-blue-300">
                  {new Date(blueprint.created_at).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}
                </div>
                <div style={{ color: theme.colors.textSecondary }} className="text-xs flex items-center justify-center mt-0.5">
                  <Calendar className="w-3 h-3 mr-0.5" />
                  Uploaded
                </div>
              </div>
            </div>

            {/* Creator Info */}
            <div style={{
              backgroundImage: `linear-gradient(to right, ${theme.colors.gradientFrom}30, ${theme.colors.gradientTo}30)`,
              borderColor: theme.colors.cardBorder,
            }} className="p-2 rounded-lg border-2 shadow-lg lg:flex-1 hover:shadow-xl transition" onMouseEnter={(e) => e.currentTarget.style.backgroundImage = `linear-gradient(to right, ${theme.colors.gradientFrom}60, ${theme.colors.gradientTo}60)`} onMouseLeave={(e) => e.currentTarget.style.backgroundImage = `linear-gradient(to right, ${theme.colors.gradientFrom}30, ${theme.colors.gradientTo}30)`}>
              <div className="flex items-center gap-2 h-full">
                <User className="w-4 h-4 flex-shrink-0" style={{ color: theme.colors.accentYellow }} />
                <div className="min-w-0">
                  <p style={{ color: theme.colors.textPrimary }} className="font-semibold text-xs">Creator</p>
                  <button
                    onClick={handleCreatorClick}
                    style={{ color: theme.colors.accentYellow }}
                    className="font-semibold hover:underline transition cursor-pointer text-sm"
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
              <h3 style={{ color: theme.colors.accentYellow }} className="text-lg font-bold mb-2">Description</h3>
              <p style={{ color: theme.colors.textPrimary }} className="leading-relaxed whitespace-pre-wrap break-words">
                {parseUrlsInText(blueprint.description).map((part, idx) => {
                  if (typeof part === 'string') {
                    return <span key={idx}>{part}</span>;
                  }
                  if (part.type === 'link') {
                    return (
                      <a
                        key={idx}
                        href={part.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: theme.colors.accentGold }}
                        className="hover:underline transition"
                        title={part.url}
                      >
                        {part.text}
                      </a>
                    );
                  }
                  return null;
                })}
              </p>
            </div>
          )}

          {/* Blueprint Data*/}
          {blueprint.parsed && (
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm px-2 p-1">
              {/* Min Tier */}
              {blueprint.parsed.MinTierRequired !== undefined && (
                <div className="flex items-center gap-2">
                  <span style={{ color: theme.colors.accentYellow }} className="font-semibold">Min Tier:</span>
                  <span 
                    style={{ 
                      color: theme.colors.accentYellow,
                      backgroundColor: theme.colors.cardBg,
                      borderColor: theme.colors.cardBorder
                    }} 
                    className="px-3 py-1 rounded border font-bold"
                  >
                    {blueprint.parsed.MinTierRequired}
                  </span>
                </div>
              )}

              {/* Inventory Slots */}
              {blueprint.parsed.InventorySlotsRequired !== undefined && (
                <div className="flex items-center gap-2">
                  <span style={{ color: theme.colors.accentYellow }} className="font-semibold">Inventory Slots:</span>
                  <span 
                    style={{ 
                      color: theme.colors.accentYellow,
                      backgroundColor: theme.colors.cardBg,
                      borderColor: theme.colors.cardBorder
                    }} 
                    className="px-3 py-1 rounded border font-bold"
                  >
                    {blueprint.parsed.InventorySlotsRequired}
                  </span>
                </div>
              )}

              {/* Grid Area */}
              {blueprint.parsed.GridArea && (
                <div className="flex items-center gap-2">
                  <span style={{ color: theme.colors.accentYellow }} className="font-semibold">Grid Size:</span>
                  <span 
                    style={{ 
                      color: theme.colors.accentYellow,
                      backgroundColor: theme.colors.cardBg,
                      borderColor: theme.colors.cardBorder
                    }} 
                    className="px-3 py-1 rounded border font-bold"
                  >
                    {blueprint.parsed.GridArea.x} × {blueprint.parsed.GridArea.y}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Materials and Buildings */}
          <BlueprintStats 
            key={`${blueprint.id}-stats`}
            materials={blueprint.materials || []} 
            buildings={blueprint.buildings || []} 
          />

          {/* Skills */}
              {blueprint.skills && blueprint.skills.length > 0 && (
                <div>
                  <h3 style={{ color: theme.colors.accentYellow }} className="text-lg font-bold mb-2">Required Skills</h3>
                  <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-11 gap-1">
                    {blueprint.skills.map((skill) => (
                      <div
                        key={skill.id}
                        className="flex flex-col items-center text-center"
                        title={`${skill.name}: Level ${skill.level}`}
                      >
                        {/* SKILL ICON CONTAINER */}
                        <div style={{ borderColor: theme.colors.cardBorder }} className="rounded border w-full aspect-square flex items-center justify-center overflow-hidden mb-1 relative">

                          {skill.icon ? (
                            <>
                              <img
                                src={skill.icon}
                                alt={skill.name}
                                className="w-full h-full object-cover relative z-0"
                              />

                              {/* TINT OVERLAY */}
                              <div
                                className="absolute inset-0 w-full h-full **mix-blend-color** z-10"
                                style={{ backgroundColor: theme.colors.headerGradientFrom, opacity: 0.7 }}
                              />
                            </>
                          ) : (
                            <span className="text-[#6b5d45] text-xs">No icon</span>
                          )}

                        </div>
                        <div style={{ color: theme.colors.accentYellow }} className="text-xs font-bold leading-tight">
                          Lvl {skill.level}
                        </div>
                        <div style={{ color: theme.colors.textPrimary }} className="text-xs truncate max-w-full line-clamp-2 text-[10px]">
                          {skill.name}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

          {/* Tags */}
          {blueprint.tags && blueprint.tags.length > 0 && (
            <div>
              <h3 style={{ color: theme.colors.accentYellow }} className="text-lg font-bold mb-3">Tags</h3>
              <div className="flex flex-wrap gap-2">
                {blueprint.tags.map((tag) => (
                  <span
                    key={tag}
                    style={{
                      backgroundColor: `${theme.colors.cardBg}50`,
                      color: theme.colors.textPrimary,
                      borderColor: theme.colors.cardBorder,
                    }}
                    className="px-3 py-1 rounded-lg text-sm font-medium border shadow"
                  >
                    {tag}
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
          <div style={{
            color: theme.colors.textSecondary,
            borderTopColor: theme.colors.cardBorder,
          }} className="text-sm pt-4 border-t space-y-2">
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
            {blueprint.filehash && (
              <div className="text-xs px-2 py-1 rounded-md -mx-2" style={{color: theme.colors.textTertiary, backgroundColor: 'rgba(0, 0, 0, 0.1)'}}>
                <div className="opacity-75" style={{ fontStyle: 'italic' }}>Blueprint File Hash: <span className="font-mono break-all pl-1">{blueprint.filehash}</span></div>
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div style={{
          background: `linear-gradient(to top, ${theme.colors.headerGradientFrom}, ${theme.colors.headerGradientVia}, ${theme.colors.headerGradientTo})`,
          borderTopColor: theme.colors.cardBorder,
        }} className="sticky bottom-0 p-3 sm:p-6 flex gap-2 sm:gap-3 border-t-2 flex-wrap relative z-[10] text-white">
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
            >
              <div style={{
                borderColor: theme.colors.cardBorder,
                backgroundColor: `${theme.colors.cardBg}90`,
              }} className="w-10 h-10 rounded-full border-2 flex items-center justify-center">
                <ChevronDown style={{ color: theme.colors.textPrimary }} className="w-5 h-5" />
              </div>
            </button>
          )}
          <button
            onClick={handleDownloadClick}
            className="flex-1 min-w-0 bg-[#121212]/50 hover:bg-[#121212]/70 hover:text-green-500 py-2 sm:py-3 rounded-lg font-semibold transition flex items-center justify-center gap-1 sm:gap-2 text-sm sm:text-base"
          >
            <Download className="w-4 h-4 sm:w-5 sm:h-5" />
            <span className="hidden sm:inline">Download</span>
            <span className="sm:hidden">Download</span>
          </button>
          <button
            onClick={handleLike}
            className={`flex-1 min-w-0 flex items-center justify-center gap-1 sm:gap-2 py-2 sm:py-3 rounded-lg font-semibold transition text-sm sm:text-base ${
              isLiked
                ? "bg-[#121212]/30 text-red"
                : "bg-[#121212]/50 hover:bg-[#121212]/70 hover:text-red-500"
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
                ? "bg-[#121212]/30"
                : "bg-[#121212]/50 hover:bg-[#121212]/70 hover:text-blue-500"
            }`}
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
              className="px-2 sm:px-4 py-2 sm:py-3 rounded-lg font-semibold transition flex items-center justify-center gap-1 sm:gap-2 bg-[#121212]/50 hover:bg-[#121212]/70 hover:text-red-500 hover:text-red-500 text-sm sm:text-base"
            >
              <Edit2 className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="hidden sm:inline">Edit</span>
            </button>
          )}
        </div>
      </motion.div>

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
                onError={() => setImageError(true)}
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
        </motion.div>
      )}
    </AnimatePresence>
  );
}