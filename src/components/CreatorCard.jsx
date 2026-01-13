import { User, FileText, Download, Heart } from "lucide-react";
import { motion } from "framer-motion";
import { useTheme } from "../lib/ThemeContext";
import { sanitizeCreatorName } from "../lib/sanitization";
import { stripDiscordDiscriminator } from "../lib/discordUtils";

export default function CreatorCard({ creatorName, blueprintCount, totalDownloads, totalLikes }) {
  const { theme } = useTheme();

  return (
    <motion.div
      className="cursor-default"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.2 }}
    >
      <div
        style={{
          backgroundColor: theme.colors.cardBg,
          backgroundImage: `linear-gradient(to bottom-right, ${theme.colors.cardBg}99, ${theme.colors.elementBgDark}99)`,
          borderColor: theme.colors.cardBorder,
        }}
        className="border-2 rounded-xl overflow-hidden shadow-lg transition-all h-full"
      >
        {/* Creator Icon/Badge Area */}
        <div
          style={{
            backgroundImage: `linear-gradient(to right, ${theme.colors.gradientFrom}20, ${theme.colors.gradientTo}20)`,
          }}
          className="h-48 flex items-center justify-center relative"
        >
          <div className="text-center">
            <div
              style={{
                backgroundColor: `${theme.colors.cardBg}DD`,
                borderColor: theme.colors.cardBorder,
              }}
              className="w-24 h-24 rounded-full border-2 flex items-center justify-center mx-auto mb-3"
            >
              <User className="w-12 h-12" style={{ color: theme.colors.accentYellow }} />
            </div>
            <div
              style={{
                backgroundColor: `${theme.colors.cardBg}EE`,
                borderColor: theme.colors.cardBorder,
              }}
              className="inline-block px-4 py-1 rounded-full border"
            >
              <span style={{ color: theme.colors.textPrimary }} className="text-sm font-bold">
                <h3
            style={{
              color: theme.colors.accentYellow,
            }}
            className="text-lg font-bold truncate"
          >
            {sanitizeCreatorName(stripDiscordDiscriminator(creatorName))}
          </h3>
              </span>
            </div>
          </div>
        </div>

        {/* Creator Info */}
        <div className="p-4 space-y-3">
          {/* Stats Grid */}
          <div className="space-y-2">
            {/* Blueprints */}
            <div
              style={{
                backgroundColor: `${theme.colors.cardBg}88`,
                backgroundImage: `linear-gradient(to right, ${theme.colors.gradientFrom}15, ${theme.colors.gradientTo}15)`,
              }}
              className="p-3 rounded-lg flex items-center gap-3"
            >
              <FileText className="w-5 h-5 flex-shrink-0" style={{ color: theme.colors.accentYellow }} />
              <div className="flex-1 min-w-0">
                <div style={{ color: theme.colors.textSecondary }} className="text-xs">
                  Blueprints
                </div>
                <div style={{ color: theme.colors.accentYellow }} className="text-lg font-bold">
                  {blueprintCount}
                </div>
              </div>
            </div>

            {/* Downloads */}
            <div
              style={{
                backgroundColor: `${theme.colors.cardBg}88`,
                backgroundImage: `linear-gradient(to right, ${theme.colors.gradientFrom}15, ${theme.colors.gradientTo}15)`,
              }}
              className="p-3 rounded-lg flex items-center gap-3"
            >
              <Download className="w-5 h-5 flex-shrink-0" style={{ color: theme.colors.accentYellow }} />
              <div className="flex-1 min-w-0">
                <div style={{ color: theme.colors.textSecondary }} className="text-xs">
                  Downloads
                </div>
                <div style={{ color: theme.colors.accentYellow }} className="text-lg font-bold">
                  {totalDownloads}
                </div>
              </div>
            </div>

            {/* Likes */}
            <div
              style={{
                backgroundColor: `${theme.colors.cardBg}88`,
                backgroundImage: `linear-gradient(to right, ${theme.colors.gradientFrom}15, ${theme.colors.gradientTo}15)`,
              }}
              className="p-3 rounded-lg flex items-center gap-3"
            >
              <Heart className="w-5 h-5 flex-shrink-0 text-rose-400" />
              <div className="flex-1 min-w-0">
                <div style={{ color: theme.colors.textSecondary }} className="text-xs">
                  Likes
                </div>
                <div className="text-lg font-bold text-rose-400">
                  {totalLikes}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
