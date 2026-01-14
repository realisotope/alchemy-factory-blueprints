import { createContext, useContext, useState, useCallback, useEffect } from 'react';

const BlueprintFolderContext = createContext(null);

export function BlueprintFolderProvider({ children }) {
  const [localBlueprints, setLocalBlueprints] = useState(new Map());
  const [isScanning, setIsScanning] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    const savedData = localStorage.getItem('blueprintFolderData');
    if (savedData) {
      try {
        const parsed = JSON.parse(savedData);
        // Convert array back to Map
        const blueprintMap = new Map(parsed);
        setLocalBlueprints(blueprintMap);
        console.log(`📂 Restored ${blueprintMap.size} blueprint(s) from cache`);
      } catch (error) {
        console.error('Error loading cached blueprint data:', error);
        localStorage.removeItem('blueprintFolderData');
      }
    }
  }, []);

  const normalizeKey = (str) => {
    return str
      .toLowerCase()
      .replace(/[\s_]+/g, '-')
      .replace(/&/g, 'and')
      .replace(/[^\w-]/g, '');
  };

  const formatTitleToFilename = (title) => {
    return normalizeKey(title);
  };

  const extractTimestampFromFilename = (filename) => {
    const match = filename.match(/_(\d+)\.[^.]+$/);
    return match ? parseInt(match[1], 10) : null;
  };

  const extractBaseName = (filename) => {
    return filename.replace(/\.[^.]+$/, '').replace(/_\d+$/, '');
  };

  /**
   * Handle folder selection via webkitdirectory
   * Extracts blueprint file info and stores mapping by base name
   */
  const handleFolderSelect = useCallback(async (fileList) => {
    setIsScanning(true);
    console.log('🔍 Starting folder scan...');
    try {
      const blueprintMap = new Map();

      for (const file of fileList) {
        const filename = file.name;
        
        if (filename.endsWith('.af') || filename.endsWith('.png')) {
          const baseName = extractBaseName(filename);
          const normalizedKey = normalizeKey(baseName);
          const serverTimestamp = extractTimestampFromFilename(filename);
          
          if (blueprintMap.has(normalizedKey)) {
            const existing = blueprintMap.get(normalizedKey);
            if (serverTimestamp && existing.serverTimestamp && serverTimestamp <= existing.serverTimestamp) {
              continue;
            }
          }
          
          blueprintMap.set(normalizedKey, {
            filename,
            lastModified: file.lastModified,
            lastModifiedDate: new Date(file.lastModified),
            size: file.size,
            path: file.webkitRelativePath,
            serverTimestamp,
          });
        }
      }

      console.log(`✅ Found ${blueprintMap.size} blueprint file(s)`);
      if (blueprintMap.size > 0) {
        const keys = Array.from(blueprintMap.entries()).map(([key, file]) => 
          `${key} (local: ${file.serverTimestamp}, file: ${file.filename})`
        );
        console.log('📍 Blueprint mapping:', keys.join(', '));
      }
      
      setLocalBlueprints(blueprintMap);
      
      // Save to localStorage for persistence
      try {
        const dataToStore = Array.from(blueprintMap.entries());
        localStorage.setItem('blueprintFolderData', JSON.stringify(dataToStore));
        localStorage.setItem('blueprintFolderSyncTime', new Date().toISOString());
        console.log('💾 Synced folder cached in localStorage');
      } catch (storageError) {
        console.error('Error saving to localStorage:', storageError);
      }
      
      return blueprintMap;
    } finally {
      setIsScanning(false);
    }
  }, [extractBaseName, extractTimestampFromFilename, normalizeKey]);

   // Compare remote blueprint with local files by timestamp
  const getInstallStatus = useCallback((blueprint) => {
    if (!blueprint || !blueprint.title || localBlueprints.size === 0) {
      return 'not-installed';
    }

    let remoteTimestamp = null;
    let remoteKey = null;
    
    if (blueprint.file_url) {
      const urlParts = blueprint.file_url.split('/');
      const downloadFilename = urlParts[urlParts.length - 1];
      const match = downloadFilename.match(/_(\d+)\.[^.]+$/);
      remoteTimestamp = match ? parseInt(match[1], 10) : null;
      
      if (remoteTimestamp) {
        const baseName = extractBaseName(downloadFilename);
        remoteKey = normalizeKey(baseName);
      }
    }

    if (!remoteTimestamp) {
      return 'not-installed';
    }

    // Direct lookup using actual filename from file_url
    if (remoteKey && localBlueprints.has(remoteKey)) {
      const localFile = localBlueprints.get(remoteKey);
      console.log(`[getInstallStatus] "${blueprint.title}" matched by filename. local: ${localFile.serverTimestamp}, remote: ${remoteTimestamp}`);
      
      if (remoteTimestamp > localFile.serverTimestamp) {
        console.log(`✓ "${blueprint.title}": Update available (remote: ${remoteTimestamp}, local: ${localFile.serverTimestamp})`);
        return 'update-available';
      }
      
      console.log(`✓ "${blueprint.title}": Installed`);
      return 'installed';
    }

    // Format the blueprint title to match the expected key format (fallback)
    const expectedKey = formatTitleToFilename(blueprint.title);
    
    if (localBlueprints.has(expectedKey)) {
      const localFile = localBlueprints.get(expectedKey);
      console.log(`[getInstallStatus] "${blueprint.title}" matched by title. local: ${localFile.serverTimestamp}, remote: ${remoteTimestamp}`);
      
      if (remoteTimestamp > localFile.serverTimestamp) {
        console.log(`✓ "${blueprint.title}": Update available (remote: ${remoteTimestamp}, local: ${localFile.serverTimestamp})`);
        return 'update-available';
      }
      
      console.log(`✓ "${blueprint.title}": Installed`);
      return 'installed';
    }

    // Fuzzy match (normalize and compare) - last resort
    const expectedKeyNormalized = expectedKey.replace(/[-_\s]/g, '');
    for (const [key, file] of localBlueprints.entries()) {
      const keyNormalized = key.replace(/[-_\s]/g, '');
      
      if (keyNormalized === expectedKeyNormalized) {
        console.log(`[getInstallStatus] "${blueprint.title}" matched via fuzzy match. local: ${file.serverTimestamp}, remote: ${remoteTimestamp}`);
        
        if (remoteTimestamp > file.serverTimestamp) {
          console.log(`✓ "${blueprint.title}": Update available (remote: ${remoteTimestamp}, local: ${file.serverTimestamp})`);
          return 'update-available';
        }
        
        console.log(`✓ "${blueprint.title}": Installed`);
        return 'installed';
      }
    }

    return 'not-installed';
  }, [localBlueprints, formatTitleToFilename, extractBaseName, normalizeKey]);

   // Cache a downloaded blueprint without needing folder sync
  const cacheDownloadedBlueprint = useCallback((blueprint) => {
    if (!blueprint || !blueprint.file_url) return;

    const urlParts = blueprint.file_url.split('/');
    const downloadFilename = urlParts[urlParts.length - 1];
    const serverTimestamp = extractTimestampFromFilename(downloadFilename);
    
    if (!serverTimestamp) return;
    
    const baseName = extractBaseName(downloadFilename);
    const normalizedKey = normalizeKey(baseName);
    
    const updatedBlueprints = new Map(localBlueprints);
    
    if (updatedBlueprints.has(normalizedKey)) {
      const existing = updatedBlueprints.get(normalizedKey);
      if (serverTimestamp <= existing.serverTimestamp) {
        return;
      }
    }
    
    updatedBlueprints.set(normalizedKey, {
      filename: downloadFilename,
      serverTimestamp,
      lastModified: Date.now(),
      lastModifiedDate: new Date(),
      size: 0,
      path: 'downloaded',
    });
    
    setLocalBlueprints(updatedBlueprints);
    
    // Save to localStorage for persistence
    try {
      const dataToStore = Array.from(updatedBlueprints.entries());
      localStorage.setItem('blueprintFolderData', JSON.stringify(dataToStore));
      console.log(`📥 Cached downloaded blueprint: ${blueprint.title}`);
    } catch (storageError) {
      console.error('Error caching downloaded blueprint:', storageError);
    }
  }, [localBlueprints, extractTimestampFromFilename, extractBaseName, normalizeKey]);

  const clearFolderSelection = useCallback(() => {
    setLocalBlueprints(new Map());
    localStorage.removeItem('blueprintFolderData');
    localStorage.removeItem('blueprintFolderSyncTime');
    console.log('🗑️ Folder sync cleared');
  }, []);

  const value = {
    localBlueprints,
    isScanning,
    handleFolderSelect,
    getInstallStatus,
    cacheDownloadedBlueprint,
    clearFolderSelection,
    hasFolderSelected: localBlueprints.size > 0,
  };

  return (
    <BlueprintFolderContext.Provider value={value}>
      {children}
    </BlueprintFolderContext.Provider>
  );
}

export function useBlueprintFolder() {
  const context = useContext(BlueprintFolderContext);
  if (!context) {
    throw new Error('useBlueprintFolder must be used within BlueprintFolderProvider');
  }
  return context;
}
