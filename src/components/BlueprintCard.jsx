import { useState, memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Download, Trash2, Loader, Heart, X, ChevronLeft, ChevronRight, Check, AlertCircle } from "lucide-react";
import { useTheme } from "../lib/ThemeContext";
import { getThumbnailUrl, getDetailViewUrl, prefetchImage } from "../lib/imageOptimization";
import { stripDiscordDiscriminator } from "../lib/discordUtils";
import { sanitizeCreatorName } from "../lib/sanitization";
import { useBlueprintFolder } from "../lib/BlueprintFolderContext";

function BlueprintCardComponent({
  blueprint,
  isLiked,
  downloadingId,
  deleting,
  user,
  userLikes,
  onSelect,
  onDownload,
  onLike,
  onDelete,
  onSearchByCreator,
  isFirstPage = false,
}) {
  const { theme } = useTheme();
  const [isHovered, setIsHovered] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const { getInstallStatus, cacheDownloadedBlueprint } = useBlueprintFolder();

  // Get available images
  const availableImages = [
    blueprint.image_url,
    blueprint.image_url_2,
    blueprint.image_url_3,
    blueprint.image_url_4
  ].filter(Boolean);

  const hasMultipleImages = availableImages.length > 1;

  const handlePrevImage = (e) => {
    e.stopPropagation();
    setCurrentImageIndex((prev) => (prev === 0 ? availableImages.length - 1 : prev - 1));
  };

  const handleNextImage = (e) => {
    e.stopPropagation();
    setCurrentImageIndex((prev) => (prev === availableImages.length - 1 ? 0 : prev + 1));
  };

  // Prefetch detail image on hover for instant loading
  const handleMouseEnter = () => {
    setIsHovered(true);
    if (availableImages[0]) {
      prefetchImage(getDetailViewUrl(availableImages[0]));
    }
  };

  return (
    <motion.div
      style={{
        backgroundImage: `linear-gradient(to bottom-right, ${theme.colors.cardBg}99, ${theme.colors.elementBgDark}99)`,
        borderColor: theme.colors.cardBorder,
        boxShadow: isHovered 
          ? `0 12px 18px -5px ${theme.colors.cardShadow}60`
          : `0 10px 15px -5px ${theme.colors.cardShadow}40`
      }}
      className="fade-in-card rounded-xl overflow-hidden transition-all duration-200 border-2 rounded-lg cursor-pointer flex flex-col h-full group"
      whileHover={{ y: -8, scale: 1.02, transition: { duration: 0.3, type: "spring", stiffness: 300, damping: 20 } }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => onSelect(blueprint)}
    >
      {/* Image */}
      <div className="relative overflow-hidden group/image">
        {availableImages.length > 0 && !imageError ? (
          <>
            <AnimatePresence mode="wait">
              <motion.img
                key={currentImageIndex}
                src={getThumbnailUrl(availableImages[currentImageIndex])}
                alt={blueprint.title}
                style={{ backgroundColor: theme.colors.elementBg }}
                className="w-full h-48 object-cover flex-shrink-0"
                loading={isFirstPage ? "eager" : "lazy"}
                onError={() => setImageError(true)}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              />
            </AnimatePresence>
            {/* IPM Badge - Disabled for now */}
            {false && blueprint.production_rate != null && (
              <div className="absolute top-2 right-2 px-2 py-1 rounded text-xs font-semibold" style={{
                backgroundColor: theme.colors.primary,
                color: theme.colors.accentYellow,
              }}>
                {blueprint.production_rate.toFixed(2)} IPM
              </div>
            )}

            {/* Multi-Part Badge */}
            {blueprint.is_multi_part && blueprint.parts && Array.isArray(blueprint.parts) && (
              <div className="absolute top-2 right-2 px-3 py-1 rounded text-xs font-semibold" style={{
                backgroundColor: theme.colors.accentGold,
                color: theme.colors.buttonText,
              }}>
                {blueprint.parts.length}-Part
              </div>
            )}

            {/* Tint Overlay */}
            <div 
              className="absolute inset-0 w-full h-full pointer-events-none transition-opacity duration-200"
              style={{ 
                backgroundColor: theme.colors.elementBgDark,
                opacity: isHovered ? 0 : 0.2
              }}
            />
          </>
        ) : (
          <div style={{ backgroundImage: `linear-gradient(to bottom-right, ${theme.colors.accentLighter}, ${theme.colors.cardBg})`, backgroundColor: theme.colors.cardBg }} className="w-full h-48 flex items-center justify-center flex-shrink-0">
            <span className="text-4xl">⚗️</span>
          </div>
        )}

        {/* Image Navigation */}
        {hasMultipleImages && !imageError && (
          <>
            {/* Navigation Arrows */}
            <button
              onClick={handlePrevImage}
              style={{
                backgroundColor: `${theme.colors.cardBg}CC`,
                borderColor: theme.colors.cardBorder
              }}
              className="absolute left-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full border opacity-0 group-hover:opacity-100 transition-opacity hover:scale-110"
            >
              <ChevronLeft className="w-4 h-4" style={{ color: theme.colors.textPrimary }} />
            </button>
            <button
              onClick={handleNextImage}
              style={{
                backgroundColor: `${theme.colors.cardBg}CC`,
                borderColor: theme.colors.cardBorder
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full border opacity-0 group-hover:opacity-100 transition-opacity hover:scale-110"
            >
              <ChevronRight className="w-4 h-4" style={{ color: theme.colors.textPrimary }} />
            </button>

            {/* Image Indicators */}
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
              {availableImages.map((_, index) => (
                <button
                  key={index}
                  onClick={(e) => {
                    e.stopPropagation();
                    setCurrentImageIndex(index);
                  }}
                  style={{
                    backgroundColor: index === currentImageIndex ? theme.colors.accentYellow : `${theme.colors.cardBg}AA`,
                    borderColor: theme.colors.cardBorder
                  }}
                  className="w-2 h-2 rounded-full border transition-all hover:scale-125"
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Gallery Content*/}
      <div style={{
        backgroundImage: `linear-gradient(to bottom, ${theme.colors.cardBg}, ${theme.colors.elementBgDark})`
      }} className="p-4 space-y-2 flex-grow flex flex-col">
        {/* Title and Description */}
        <div>
          <h3 style={{ color: theme.colors.accentYellow }} className="text-md font-bold truncate group-hover:opacity-80 transition">
            {blueprint.title}
          </h3>

          <p style={{ color: theme.colors.textSecondary }} className="text-sm line-clamp-3 mt-1">
            {blueprint.description || "No description provided."}
          </p>
        </div>

        <div className="flex-grow"></div>

        {/* Tags */}
        {blueprint.tags && blueprint.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {blueprint.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                style={{
                  backgroundColor: `${theme.colors.cardBg}99`,
                  color: theme.colors.textPrimary,
                  borderColor: `${theme.colors.cardBorder}66`
                }}
                className="text-xs px-2.5 py-1 rounded-xl border font-medium hover:opacity-80 transition"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Stats */}
        <div style={{
          color: theme.colors.textSecondary,
          borderColor: `${theme.colors.cardBorder}66`
        }} className="flex gap-4 text-sm border-t pt-3 flex-wrap items-center">
          <div className="flex items-center gap-1 hover:opacity-80 transition" style={{ color: theme.colors.textPrimary }}>
            <Download className="w-4 h-4" />
            <span>{blueprint.downloads || 0}</span>
          </div>
          <div className="flex items-center gap-1 hover:text-rose-400 transition">
            <Heart className="w-4 h-4" />
            <span>{blueprint.likes || 0}</span>
          </div>
          <div style={{ color: theme.colors.textSecondary }} className="text-xs ml-auto">
            <p style={{ color: theme.colors.textSecondary }} className="font-semibold hover:opacity-80 transition">
              by{" "}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (onSearchByCreator) {
                    onSearchByCreator(blueprint.creator_name);
                  }
                }}
                style={{ color: theme.colors.accentYellow }}
                className="hover:opacity-80 hover:underline transition cursor-pointer"
              >
                {sanitizeCreatorName(stripDiscordDiscriminator(blueprint.creator_name))}
              </button>
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 mt-auto">
          {(() => {
            const installStatus = getInstallStatus(blueprint);
            const isDownloading = downloadingId === blueprint.id;
            
            if (installStatus !== 'not-installed') {
              //console.log(`[BlueprintCard] "${blueprint.title}" status: ${installStatus}`);
            }

            const statusConfig = {
              'installed': {
                icon: Check,
                text: 'Installed',
                bgColor: `${theme.colors.buttonBg2}40`,
                textColor: `${theme.colors.accentYellow}50`,
              },
              'update-available': {
                icon: AlertCircle,
                text: 'Update Available',
                bgColor: `${theme.colors.buttonBg2}80`,
                textColor: `${theme.colors.accentYellow}`,
              },
              'not-installed': {
                icon: Download,
                text: 'Download',
                bgColor: `${theme.colors.buttonBg2}80`,
                textColor: theme.colors.textPrimary,
              }
            };

            const status = statusConfig[installStatus];
            const StatusIcon = status.icon;

            return (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDownload(blueprint);
                  // Cache the blueprint so it shows as installed next time
                  cacheDownloadedBlueprint(blueprint);
                }}
                disabled={isDownloading}
                style={{
                  backgroundColor: status.bgColor,
                  color: status.textColor
                }}
                className="flex-1 font-semibold py-2 rounded-lg transition shadow-md hover:opacity-60 hover:scale-105 disabled:opacity-50 flex items-center justify-center text-sm"
              >
                {isDownloading ? (
                  <Loader className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <StatusIcon className="w-4 h-4 mr-1" />
                    {status.text}
                  </>
                )}
              </button>
            );
          })()}

          <button
            onClick={(e) => {
              e.stopPropagation();
              onLike(blueprint.id, isLiked);
            }}
            style={{
              backgroundColor: isLiked ? `${theme.colors.buttonBg2}90` : `${theme.colors.buttonBg2}80`,
              color: isLiked ? theme.colors.buttonBg : theme.colors.textPrimary
            }}
            className="px-3 py-2 rounded-lg transition font-semibold flex items-center justify-center hover:opacity-50 hover:scale-105"
          >
            <Heart className={`w-4 h-4 ${isLiked ? "fill-current" : ""}`} />
          </button>

          {user && blueprint.user_id === user.id && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(blueprint);
              }}
              disabled={deleting === blueprint.id}
              style={{
                backgroundColor: `${theme.colors.buttonBg2}90`
              }}
              className="font-semibold py-2 px-3 rounded-lg transition flex items-center text-red-500 justify-center hover:opacity-50 hover:scale-105 disabled:opacity-50"
            >
              {deleting === blueprint.id ? (
                <Loader className="w-4 h-4 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4" />
              )}
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

export default memo(BlueprintCardComponent, (prevProps, nextProps) => {
  // Return true if props are the same (don't re-render)
  // Return false if props are different (re-render)
  return (
    prevProps.blueprint.id === nextProps.blueprint.id &&
    prevProps.isLiked === nextProps.isLiked &&
    prevProps.downloadingId === nextProps.downloadingId &&
    prevProps.deleting === nextProps.deleting &&
    prevProps.user?.id === nextProps.user?.id &&
    prevProps.onSelect === nextProps.onSelect &&
    prevProps.onDownload === nextProps.onDownload &&
    prevProps.onLike === nextProps.onLike &&
    prevProps.onDelete === nextProps.onDelete &&
    prevProps.onSearchByCreator === nextProps.onSearchByCreator &&
    prevProps.isFirstPage === nextProps.isFirstPage
  );
});
