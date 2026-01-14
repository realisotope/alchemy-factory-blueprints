import { useState, useEffect, useCallback } from 'react';

/**
 * Hook for managing blueprint folder sync
 * Allows users to select their blueprints folder and compare local files with remote blueprints
 */
export function useBlueprintFolder() {
  const [localBlueprints, setLocalBlueprints] = useState(new Map());
  const [folderPath, setFolderPath] = useState(null);
  const [isScanning, setIsScanning] = useState(false);

  useEffect(() => {
    const savedPath = localStorage.getItem('blueprintFolderPath');
    if (savedPath) {
      setFolderPath(savedPath);
    }
  }, []);

  // Handle folder selection via webkitdirectory
  const handleFolderSelect = useCallback(async (fileList) => {
    setIsScanning(true);
    try {
      const blueprintMap = new Map();

      for (const file of fileList) {
        const filename = file.name;

        if (filename.endsWith('.af') || filename.endsWith('.png')) {
          const baseName = filename.replace(/\.[^.]+$/, '').replace(/_\d+$/, '');
          blueprintMap.set(baseName, {
            filename,
            lastModified: file.lastModified,
            lastModifiedDate: new Date(file.lastModified),
            size: file.size,
            path: file.webkitRelativePath,
          });
        }
      }

      setLocalBlueprints(blueprintMap);
      localStorage.setItem('blueprintFolderSyncTime', new Date().toISOString());
      
      return blueprintMap;
    } finally {
      setIsScanning(false);
    }
  }, []);

   // Compare a remote blueprint with local files
  const getInstallStatus = useCallback((blueprint) => {
    if (!blueprint || !blueprint.title) return 'not-installed';

    const blueprintName = blueprint.title.toLowerCase().replace(/\s+/g, '-');
    
    // Exact match on stored name
    if (localBlueprints.has(blueprintName)) {
      const localFile = localBlueprints.get(blueprintName);
      const remoteModified = new Date(blueprint.updated_at || blueprint.created_at).getTime();
      const localModified = localFile.lastModified;

      // If remote is newer, update is available
      if (remoteModified > localModified) {
        return 'update-available';
      }
      return 'installed';
    }

    // Check with underscores instead of hyphens
    const blueprintNameUnderscore = blueprint.title.toLowerCase().replace(/\s+/g, '_');
    if (localBlueprints.has(blueprintNameUnderscore)) {
      const localFile = localBlueprints.get(blueprintNameUnderscore);
      const remoteModified = new Date(blueprint.updated_at || blueprint.created_at).getTime();
      const localModified = localFile.lastModified;

      if (remoteModified > localModified) {
        return 'update-available';
      }
      return 'installed';
    }

    // Search by slug if available @@
    if (blueprint.slug) {
      if (localBlueprints.has(blueprint.slug)) {
        const localFile = localBlueprints.get(blueprint.slug);
        const remoteModified = new Date(blueprint.updated_at || blueprint.created_at).getTime();
        const localModified = localFile.lastModified;

        if (remoteModified > localModified) {
          return 'update-available';
        }
        return 'installed';
      }
    }

    return 'not-installed';
  }, [localBlueprints]);

  const clearFolderSelection = useCallback(() => {
    setLocalBlueprints(new Map());
    setFolderPath(null);
    localStorage.removeItem('blueprintFolderSyncTime');
  }, []);

  return {
    localBlueprints,
    folderPath,
    isScanning,
    handleFolderSelect,
    getInstallStatus,
    clearFolderSelection,
    hasFolderSelected: localBlueprints.size > 0,
  };
}
