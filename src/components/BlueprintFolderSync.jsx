import { useState, useRef } from 'react';
import { FolderOpen, X, Check } from 'lucide-react';
import { useTheme } from '../lib/ThemeContext';
import { useBlueprintFolder } from '../lib/BlueprintFolderContext';

export default function BlueprintFolderSync() {
  const { theme } = useTheme();
  const { 
    hasFolderSelected, 
    isScanning, 
    localBlueprints, 
    handleFolderSelect, 
    clearFolderSelection 
  } = useBlueprintFolder();
  const fileInputRef = useRef(null);
  const [showFeedback, setShowFeedback] = useState(false);

  const handleFolderClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileInputChange = async (e) => {
    const files = e.currentTarget.files;
    if (files && files.length > 0) {
      console.log(`📂 Folder selected with ${files.length} files`);
      await handleFolderSelect(files);
      setShowFeedback(true);
      setTimeout(() => setShowFeedback(false), 3000);
    } else {
      console.log('❌ No files selected');
    }
  };

  return (
    <div className="relative">
      {/* Hidden file input with webkitdirectory */}
      <input
        ref={fileInputRef}
        type="file"
        webkitdirectory="true"
        directory="true"
        multiple
        onChange={handleFileInputChange}
        className="hidden"
        disabled={isScanning}
      />

      {/* Folder sync button */}
      <button
        onClick={handleFolderClick}
        disabled={isScanning}
        className="inline-flex items-center gap-2 px-3 py-2.5 rounded-lg transition disabled:opacity-50 group shadow-lg hover:shadow-xl hover:scale-105 hover:opacity-70"
        style={{
          backgroundColor: hasFolderSelected 
            ? `${theme.colors.tertiary}40` 
            : `${theme.colors.tertiary}80`,
          borderWidth: '2px',
          borderStyle: 'solid',
          borderColor: hasFolderSelected 
            ? theme.colors.headerBorder
            : theme.colors.headerBorder,
          color: hasFolderSelected ? theme.colors.accentYellow : theme.colors.textPrimary,
        }}
        data-tooltip={hasFolderSelected 
          ? `${localBlueprints.size} blueprints synced. Click to update or press the X to clear.` 
          : 'Select your blueprints folder to sync their install/version with the site. (This just runs a name match.)'}
        data-tooltip-position="bottom"
      >
        <FolderOpen className="w-4 h-4" />
        <span className="text-sm font-medium">
          {isScanning ? 'Scanning...' : hasFolderSelected ? `${localBlueprints.size}` : 'Sync'}
        </span>
        {hasFolderSelected && (
          <X 
            className="w-4 h-4 ml-1 opacity-70 group-hover:opacity-100 transition" 
            onClick={(e) => {
              e.stopPropagation();
              clearFolderSelection();
            }}
          />
        )}
      </button>

      {/* Feedback message */}
      {showFeedback && hasFolderSelected && (
        <div
          className="absolute top-full left-0 mt-2 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap z-10"
          style={{
            backgroundColor: `${theme.colors.gradientTo}80`,
            borderColor: theme.colors.accentGold,
            color: theme.colors.accentYellow,
            border: '2px solid',
          }}
        >
          <div className="flex items-center gap-1">
            <Check className="w-4 h-4" />
            Synced {localBlueprints.size} blueprints.
          </div>
        </div>
      )}
    </div>
  );
}
