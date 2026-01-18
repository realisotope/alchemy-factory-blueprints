import React, { useRef, useState, useEffect } from 'react';
import { X, Upload, Save } from 'lucide-react';
import { useTheme } from '../lib/ThemeContext';
import { saveSaveData, getSaveMetadata, clearSaveData, hasSaveData } from '../lib/saveManager';

export default function SavegameSync() {
  const { theme } = useTheme();
  const fileInputRef = useRef(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(false);
  const [progress, setProgress] = useState(0);
  const [hasSave, setHasSave] = useState(() => hasSaveData());
  const metadata = getSaveMetadata();

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    setError(false);
    setProgress(0);
    setHasSave(false);

    try {
      console.log('📁 Save file selected:', file.name, 'Size:', file.size, 'bytes');

      const PARSER_HOST = 'https://alchemy-save-parser.faulty.ws';

      // Step 1: Create a stream
      console.log('🔗 Creating stream...');
      const streamResp = await fetch(`${PARSER_HOST}/logs/create/stream`);
      if (!streamResp.ok) {
        throw new Error(`Failed to create stream: ${streamResp.status}`);
      }
      const { streamUrl, id } = await streamResp.json();
      console.log('✅ Stream created with ID:', id);

      // Helper to decompress JSONC fields
      const decodeJSONCompressed = (jsonc) => {
        const dict = jsonc._;
        const decodeRow = (row) => {
          if (Array.isArray(row[0])) {
            return row.map(inner => decodeRow(inner));
          }
          const obj = {};
          for (let i = 0; i < dict.length; i++) {
            obj[dict[i]] = row[i];
          }
          return obj;
        };
        return jsonc.v.map(decodeRow);
      };

      console.log('📡 Opening SSE stream for events...');
      const sseResp = fetch(`${PARSER_HOST}${streamUrl}`);

      console.log('📤 Uploading file with stream ID:', id);
      const fd = new FormData();
      fd.append('file', file);
      fd.append('id', id);
      fd.append('fullParse', 'false');

      const uploadResp = await fetch(`${PARSER_HOST}/parseSave`, {
        method: 'POST',
        body: fd,
      });

      if (!uploadResp.ok) {
        throw new Error(`Upload failed: ${uploadResp.status}`);
      }

      console.log('✅ File uploaded, reading SSE stream for parsed data...');

      // Now read the SSE stream that was initiated
      const actualSseResp = await sseResp;
      const reader = actualSseResp.body.getReader();
      const decoder = new TextDecoder();

      let parsedData = null;
      let buffer = '';
      let currentEvent = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();

        for (const line of lines) {
          if (line.startsWith('event: ')) {
            currentEvent = line.slice(7).trim();
            console.log('📡 SSE event:', currentEvent);
          }

          if (line.startsWith('data: ')) {
            console.log('📊 SSE data line:', line.slice(0, 50));
          }

          // Handle parser progress events
          if (currentEvent === 'parser' && line.startsWith('data: ')) {
            try {
              const progressData = JSON.parse(line.slice(6));
              if (progressData.progress !== undefined) {
                const progressPercent = Math.round(progressData.progress);
                console.log('⏳ Progress:', progressPercent + '%');
                setProgress(progressPercent);
              }
            } catch (e) {
              console.log('⚠️ Failed to parse parser event:', e.message);
            }
          }

          // Handle progress events (backup, in case format changes)
          if (currentEvent === 'progress' && line.startsWith('data: ')) {
            try {
              const progressData = JSON.parse(line.slice(6));
              const progressPercent = Math.round(progressData.progress || 0);
              console.log('⏳ Progress:', progressPercent + '%');
              setProgress(progressPercent);
            } catch (e) {
              console.log('⚠️ Failed to parse progress:', e.message);
            }
          }

          if (currentEvent === 'save-data' && line.startsWith('data: ')) {
            try {
              const jsonStr = line.slice(6);
              console.log('🔍 Parsing save-data JSON...');
              parsedData = JSON.parse(jsonStr);

              for (const key of Object.keys(parsedData)) {
                if (parsedData[key] && parsedData[key]._ && parsedData[key].v) {
                  console.log(`🔓 Decompressing field: ${key}`);
                  parsedData[key] = decodeJSONCompressed(parsedData[key]);
                }
              }

              console.log('✅ Decompressed save data:', parsedData);
              console.log('🔍 UnlockData check:', parsedData.UnlockData);
              reader.cancel();
              break;
            } catch (e) {
              console.log('⚠️ Failed to parse JSON:', e.message);
            }
          }
        }

        if (parsedData) break;
      }

      if (!parsedData) {
        throw new Error('No save data received from parser');
      }

      console.log('💾 Saving to localStorage...');
      const result = saveSaveData(parsedData, file.name.replace(/\.[^/.]+$/, ''));

      if (result.success) {
        console.log('✅ Save data stored successfully');
        setError(null);
        setProgress(0);
        setHasSave(true);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      } else {
        throw new Error(result.message);
      }
    } catch (err) {
      console.error('❌ Error:', err);
      setError(err.message || 'Failed to process save file');
      setProgress(0);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClear = () => {
    const result = clearSaveData();
    if (result.success) {
      setError(null);
      setHasSave(false);
    }
  };

  const displayName = metadata?.saveName || 'Save Data';
  const timeAgo = metadata
    ? (() => {
      const loadedAt = new Date(metadata.loadedAt);
      const hoursAgo = Math.floor(
        (Date.now() - loadedAt.getTime()) / (1000 * 60 * 60)
      );

      if (hoursAgo === 0) return 'just now';
      if (hoursAgo < 24) return `${hoursAgo}h ago`;
      const daysAgo = Math.floor(hoursAgo / 24);
      return `${daysAgo}d ago`;
    })()
    : '';

  return (
    <div className="relative">
      <input
        ref={fileInputRef}
        type="file"
        onChange={handleFileSelect}
        className="hidden"
        accept=".sav"
        disabled={isLoading}
      />

      {hasSave ? (
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={isLoading}
          style={{
            backgroundColor: hasSave
              ? `${theme.colors.tertiary}40`
              : `${theme.colors.tertiary}80`,
            borderWidth: '2px',
            borderStyle: 'solid',
            borderColor: theme.colors.headerBorder,
            color: hasSave ? theme.colors.accentYellow : theme.colors.textPrimary,
          }}
          className="inline-flex items-center gap-2 px-3 py-2.5 rounded-lg transition disabled:opacity-50 group shadow-lg hover:shadow-xl hover:scale-105 hover:opacity-70"
          data-tooltip-position="bottom"
          data-tooltip={`${displayName} - Synced ${timeAgo}`}
        >
          <Save className="w-4 h-4" />
          <span className="text-sm font-medium">Synced</span>
          <X
            className="w-4 h-4 ml-1 opacity-70 group-hover:opacity-100 transition"
            onClick={(e) => {
              e.stopPropagation();
              handleClear();
            }}
          />
        </button>
      ) : (
        <div style={{ position: 'relative', display: 'inline-block' }}>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading}
            style={{
              backgroundColor: `${theme.colors.tertiary}80`,
              borderWidth: '2px',
              borderStyle: 'solid',
              borderColor: theme.colors.headerBorder,
              color: theme.colors.textPrimary,
            }}
            className="inline-flex items-center gap-2 px-3 py-2.5 rounded-lg transition disabled:opacity-50 shadow-lg hover:shadow-xl hover:scale-105 hover:opacity-70 relative z-10"
            title="Upload save file to check blueprint compatibility"
          >
            <span className="text-sm font-medium">
              {isLoading && progress > 0 ? (
                `⌛ Parsing ${progress}%`
              ) : (
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <Save className="w-4 h-4" />
                  <span style={{ marginLeft: '0.5rem' }}>Sync Save</span>
                </div>
              )}
            </span>
          </button>

          {/* Progress bar overlay */}
          {isLoading && progress > 0 && (
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                height: '100%',
                width: `${progress}%`,
                backgroundColor: `${theme.colors.accentYellow}40`,
                borderRadius: '6px',
                borderTopLeftRadius: '6px',
                borderBottomLeftRadius: '6px',
                zIndex: 0,
                transition: 'width 0.2s ease-out',
              }}
            />
          )}
        </div>
      )}

      {error && (
        <div
          style={{
            backgroundColor: `${theme.colors.cardBg}cc`,
            borderColor: '#ef4444',
            color: '#fca5a5',
          }}
          className="absolute top-full mt-1 right-0 text-xs border rounded px-2 py-1 whitespace-nowrap z-50"
        >
          {error}
        </div>
      )}
    </div>
  );
}
