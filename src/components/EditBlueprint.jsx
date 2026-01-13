import { useState, useRef } from "react";
import { supabase } from "../lib/supabase";
import { stripDiscordDiscriminator } from "../lib/discordUtils";
import { validateAndSanitizeTitle, validateAndSanitizeDescription, validateAndSanitizeChangelog, sanitizeTitleForFilename } from "../lib/sanitization";
import { validateDescriptionUrls } from "../lib/urlProcessor";
import { useTheme } from "../lib/ThemeContext";
import { Upload, Loader, X } from "lucide-react";
import { uploadToCloudinary } from "../lib/cloudinary";
import { deleteCloudinaryImage } from "../lib/cloudinaryDelete";
import imageCompression from "browser-image-compression";
import JSZip from "jszip";
import { ClientRateLimiter, checkServerRateLimit } from "../lib/rateLimiter";
import { sendBlueprintToParser } from "../lib/blueprintParser";
import { extractBlueprintFromPng, isPngBlueprint, formatBytes } from "../lib/pngBlueprintExtractor";
import { AVAILABLE_TAGS } from "../lib/tags";

// Constants for validation
const MAX_IMAGE_SIZE = 4 * 1024 * 1024; // 4MB
const MAX_IMAGE_WIDTH = 4000;
const MAX_IMAGE_HEIGHT = 4000;
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const AF_FILE_MAX_SIZE = 50 * 1024 * 1024; // 50MB
const PNG_BLUEPRINT_MAX_SIZE = 20 * 1024 * 1024; // 20MB

// Validate blueprint file (.af or .png) by checking extension and file structure
const validateBlueprintFile = async (file) => {
  const fileName = file.name.toLowerCase();

  // Check extension - must end with .af or .png
  if (!fileName.endsWith(".af") && !fileName.endsWith(".png")) {
    return { valid: false, error: "File must have .af or .png extension" };
  }

  // If PNG blueprint, validate and extract
  if (fileName.endsWith(".png")) {
    // Check file size for PNG
    if (file.size > PNG_BLUEPRINT_MAX_SIZE) {
      return { valid: false, error: `PNG blueprint must be smaller than ${formatBytes(PNG_BLUEPRINT_MAX_SIZE)}` };
    }

    try {
      // Extract blueprint data from PNG (strips image data)
      const result = await extractBlueprintFromPng(file);
      
      return { 
        valid: true, 
        isPng: true,
        strippedFile: result.strippedFile,
        imageBlob: result.imageBlob, // Include extracted PNG image
        compressionInfo: {
          originalSize: result.originalSize,
          strippedSize: result.strippedSize,
          savedSpace: result.compressionRatio
        }
      };
    } catch (error) {
      return { valid: false, error: `PNG validation failed: ${error.message}` };
    }
  }

  // For .af files, continue with existing validation
  if (file.size > AF_FILE_MAX_SIZE) {
    return { valid: false, error: "Blueprint file must be smaller than 50MB" };
  }

  try {
    const buffer = await file.slice(0, 4).arrayBuffer();
    const view = new Uint8Array(buffer);
    
    if (view.length >= 2) {
      if (view[0] === 0x4d && view[1] === 0x5a) {
        return { valid: false, error: "Executable files are not allowed" };
      }
      if (view[0] === 0x23 && view[1] === 0x21) {
        return { valid: false, error: "Script files are not allowed" };
      }
    }
    if (view.length >= 4) {
      if (view[0] === 0x50 && view[1] === 0x4b && view[2] === 0x03 && view[3] === 0x04) {
        return { valid: false, error: "Archive files must be saved as .af files" };
      }
    }
  } catch (e) {
    console.warn("Could not validate file content:", e);
  }

  return { valid: true };
};

// Validate image file
const validateImageFile = async (file) => {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return { 
      valid: false, 
      error: `Invalid image type. Allowed: JPEG, PNG, WebP. Got: ${file.type}` 
    };
  }

  if (file.size > MAX_IMAGE_SIZE) {
    return { 
      valid: false, 
      error: `Image must be smaller than 5MB. Current: ${(file.size / 1024 / 1024).toFixed(2)}MB` 
    };
  }

  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      if (img.width > MAX_IMAGE_WIDTH || img.height > MAX_IMAGE_HEIGHT) {
        resolve({
          valid: false,
          error: `Image dimensions too large. Max: ${MAX_IMAGE_WIDTH}x${MAX_IMAGE_HEIGHT}. Current: ${img.width}x${img.height}`,
        });
      } else {
        resolve({ valid: true });
      }
    };
    img.onerror = () => {
      resolve({ valid: false, error: "Invalid image file" });
    };
    img.src = URL.createObjectURL(file);
  });
};

export default function EditBlueprint({ blueprint, isOpen, onClose, user, onUpdate }) {
  const { theme } = useTheme();
  const [title, setTitle] = useState(blueprint?.title || "");
  const [description, setDescription] = useState(blueprint?.description || "");
  const [changelog, setChangelog] = useState("");
  const [tags, setTags] = useState(blueprint?.tags || []);
  const [tagInput, setTagInput] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [blueprintFile, setBlueprintFile] = useState(null);
  const [imageFiles, setImageFiles] = useState([null, null, null]);
  const [imagePreviews, setImagePreviews] = useState([
    blueprint?.image_url || null,
    blueprint?.image_url_2 || null,
    blueprint?.image_url_3 || null
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [imageDragActive, setImageDragActive] = useState([false, false, false]);
  const [rateLimitInfo, setRateLimitInfo] = useState(null);
  const [processingPng, setProcessingPng] = useState(false);
  const [compressionInfo, setCompressionInfo] = useState(null);
  const [blueprintFileExtension, setBlueprintFileExtension] = useState(".af");
  const [processingState, setProcessingState] = useState(""); // Track current processing stage
  const [imageCompressionInfo, setImageCompressionInfo] = useState([null, null, null]); // Track compression info for each image
  const fileInputRef = useRef(null);
  const imageInputRef = useRef(null);

  if (!isOpen || !blueprint) return null;

  const handleSelectTag = (tag) => {
    if (tags.length >= 3) {
      setError("Maximum of 3 tags allowed");
      return;
    }
    
    if (!tags.includes(tag)) {
      setTags([...tags, tag]);
      setTagInput("");
      setDropdownOpen(false);
      setError(null);
    }
  };

  const handleRemoveTag = (tagToRemove) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  };

  const handleBlueprintSelect = async (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const isPng = isPngBlueprint(file.name);
      setProcessingPng(isPng);
      setProcessingState(isPng ? "Extracting PNG..." : "Processing...");
      
      const validation = await validateBlueprintFile(file);
      
      if (!validation.valid) {
        setProcessingPng(false);
        setProcessingState("");
        setError(validation.error);
        setBlueprintFile(null);
        setCompressionInfo(null);
        setBlueprintFileExtension(".af");
      } else {
        // If PNG, convert stripped Blob to File with proper filename; otherwise use original
        let fileToUse;
        if (validation.isPng) {
          // Convert Blob to File with original filename
          fileToUse = new File([validation.strippedFile], file.name, { type: 'image/png' });
          
          // Compress and populate the extracted PNG image as first preview
          if (validation.imageBlob) {
            try {
              setProcessingState("Compressing image...");
              const imageFile = new File([validation.imageBlob], 'preview.png', { type: 'image/png' });
              const options = {
                maxSizeMB: 0.3,
                maxWidthOrHeight: 1500,
                useWebWorker: true,
                initialQuality: 0.55,
              };
              const compressedFile = await imageCompression(imageFile, options);
              
              // Populate first image slot if empty or update existing slots
              const newFiles = [...imageFiles];
              const newPreviews = [...imagePreviews];
              const newCompressionInfo = [...imageCompressionInfo];
              
              // Find first empty slot or use slot 0
              const emptySlotIndex = newFiles.findIndex(f => f === null);
              const targetIndex = emptySlotIndex !== -1 ? emptySlotIndex : 0;
              
              newFiles[targetIndex] = compressedFile;
              newPreviews[targetIndex] = URL.createObjectURL(compressedFile);
              newCompressionInfo[targetIndex] = {
                originalSize: validation.imageBlob.size,
                compressedSize: compressedFile.size,
                fromPng: true
              };
              setImageFiles(newFiles);
              setImagePreviews(newPreviews);
              setImageCompressionInfo(newCompressionInfo);
            } catch (compressionError) {
              console.warn('Failed to compress PNG image:', compressionError);
            }
          }
        } else {
          fileToUse = file;
        }
        setBlueprintFile(fileToUse);
        setCompressionInfo(validation.compressionInfo || null);
        setBlueprintFileExtension(isPng ? ".png" : ".af");
        setError(null);
        setProcessingPng(false);
        setProcessingState("");
      }
    }
  };

  const handleImageSelect = async (e, index) => {
    const file = e.target.files?.[0];
    if (file) {
      const validation = await validateImageFile(file);
      if (!validation.valid) {
        setError(validation.error);
        const newFiles = [...imageFiles];
        const newPreviews = [...imagePreviews];
        const newCompressionInfo = [...imageCompressionInfo];
        newFiles[index] = null;
        newPreviews[index] = null;
        newCompressionInfo[index] = null;
        setImageFiles(newFiles);
        setImagePreviews(newPreviews);
        setImageCompressionInfo(newCompressionInfo);
      } else {
        // Compress image immediately
        try {
          const originalSize = file.size;
          const options = {
            maxSizeMB: 0.3,
            maxWidthOrHeight: 1500,
            useWebWorker: true,
            initialQuality: 0.55,
          };
          const compressedFile = await imageCompression(file, options);
          
          const newFiles = [...imageFiles];
          const newPreviews = [...imagePreviews];
          const newCompressionInfo = [...imageCompressionInfo];
          newFiles[index] = compressedFile;
          newPreviews[index] = URL.createObjectURL(compressedFile);
          newCompressionInfo[index] = {
            originalSize: originalSize,
            compressedSize: compressedFile.size,
            fromPng: false
          };
          setImageFiles(newFiles);
          setImagePreviews(newPreviews);
          setImageCompressionInfo(newCompressionInfo);
          setError(null);
        } catch (compressionError) {
          console.error('Image compression failed:', compressionError);
          setError('Failed to compress image. Please try a different image.');
        }
      }
    }
  };

  const handleImageDragEnter = (e, index) => {
    e.preventDefault();
    e.stopPropagation();
    const newDragStates = [...imageDragActive];
    newDragStates[index] = true;
    setImageDragActive(newDragStates);
  };

  const handleImageDragLeave = (e, index) => {
    e.preventDefault();
    e.stopPropagation();
    const newDragStates = [...imageDragActive];
    newDragStates[index] = false;
    setImageDragActive(newDragStates);
  };

  const handleImageDrop = async (e, index) => {
    e.preventDefault();
    e.stopPropagation();
    const newDragStates = [...imageDragActive];
    newDragStates[index] = false;
    setImageDragActive(newDragStates);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      const validation = await validateImageFile(file);
      if (!validation.valid) {
        setError(validation.error);
        const newFiles = [...imageFiles];
        const newPreviews = [...imagePreviews];
        const newCompressionInfo = [...imageCompressionInfo];
        newFiles[index] = null;
        newPreviews[index] = null;
        newCompressionInfo[index] = null;
        setImageFiles(newFiles);
        setImagePreviews(newPreviews);
        setImageCompressionInfo(newCompressionInfo);
      } else {
        // Compress image immediately
        try {
          const originalSize = file.size;
          const options = {
            maxSizeMB: 0.3,
            maxWidthOrHeight: 1500,
            useWebWorker: true,
            initialQuality: 0.55,
          };
          const compressedFile = await imageCompression(file, options);
          
          const newFiles = [...imageFiles];
          const newPreviews = [...imagePreviews];
          const newCompressionInfo = [...imageCompressionInfo];
          newFiles[index] = compressedFile;
          newPreviews[index] = URL.createObjectURL(compressedFile);
          newCompressionInfo[index] = {
            originalSize: originalSize,
            compressedSize: compressedFile.size,
            fromPng: false
          };
          setImageFiles(newFiles);
          setImagePreviews(newPreviews);
          setImageCompressionInfo(newCompressionInfo);
          setError(null);
        } catch (compressionError) {
          console.error('Image compression failed:', compressionError);
          setError('Failed to compress image. Please try a different image.');
        }
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Check rate limit first (before any validation)
    const clientLimiter = new ClientRateLimiter(user.id, 'edits');
    const clientLimitStatus = clientLimiter.checkLimit();
    
    if (!clientLimitStatus.allowed) {
      setError(clientLimiter.getLimitMessage());
      setRateLimitInfo(clientLimitStatus);
      return;
    }
    
    // Also check server-side rate limit (per-hour limit)
    const serverLimitStatus = await checkServerRateLimit(supabase, user.id, 'edits');
    if (!serverLimitStatus.allowed) {
      const errorMsg = `Hourly limit exceeded. You've edited ${serverLimitStatus.attempts} blueprints in the last hour. Maximum is ${serverLimitStatus.maxAttempts} per hour.`;
      setError(errorMsg);
      setRateLimitInfo(serverLimitStatus);
      return;
    }

    // Display rate limit info to user (how many edits remaining)
    setRateLimitInfo(serverLimitStatus);
    
    if (!title.trim()) {
      setError("Title is required");
      return;
    }

    if (!blueprintFile && !description) {
      setError("Either upload a new blueprint file or keep the existing one");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const titleValidation = validateAndSanitizeTitle(title);
      if (!titleValidation.valid) {
        throw new Error(titleValidation.error);
      }

      const descriptionValidation = validateAndSanitizeDescription(description);
      if (!descriptionValidation.valid) {
        throw new Error(descriptionValidation.error);
      }

      // Validate URLs in description
      const urlValidation = validateDescriptionUrls(description);
      if (!urlValidation.valid) {
        throw new Error(urlValidation.error);
      }
      const changelogValidation = validateAndSanitizeChangelog(changelog);
      if (!changelogValidation.valid) {
        throw new Error(changelogValidation.error);
      }

      let fileUrl = blueprint.file_url;

      // Upload new blueprint file if provided
      if (blueprintFile) {
        // Delete old file from storage BEFORE uploading new one
        if (blueprint.file_url) {
          try {
            // Extract the full path from the URL
            // URL format: https://...supabase.../storage/v1/object/public/blueprints/USER_ID/filename.zip
            const urlParts = blueprint.file_url.split('/');
            const publicIndex = urlParts.findIndex(part => part === 'public');
            if (publicIndex !== -1) {
              // Get user_id/filename.zip portion (everything after 'public')
              const oldFilePath = urlParts.slice(publicIndex + 2).join('/');
              if (oldFilePath) {
                const { error: deleteError } = await supabase.storage
                  .from("blueprints")
                  .remove([oldFilePath]);
                if (deleteError) {
                  console.warn("Could not delete old blueprint file:", deleteError);
                }
              }
            }
          } catch (delError) {
            console.warn("Could not parse or delete old blueprint file:", delError);
          }
        }

        // Create and upload new zip file
        // Rename the file to the blueprint title before zipping (preserving extension)
        const blueprintFileName = `${sanitizeTitleForFilename(title)}${blueprintFileExtension}`;
        
        const zip = new JSZip();
        zip.file(blueprintFileName, blueprintFile, { compression: "DEFLATE" });
        const zipBlob = await zip.generateAsync({
          type: "blob",
          compression: "DEFLATE",
          compressionOptions: { level: 9 },
        });

        const zipFileName = `${sanitizeTitleForFilename(title)}_${Date.now()}.zip`;
        const blueprintPath = `${user.id}/${zipFileName}`;
        const { error: blueprintError } = await supabase.storage
          .from("blueprints")
          .upload(blueprintPath, zipBlob);

        if (blueprintError) throw blueprintError;

        const { data: blueprintData } = supabase.storage
          .from("blueprints")
          .getPublicUrl(blueprintPath);
        fileUrl = blueprintData?.publicUrl;
      }

      let imageUrl = blueprint.image_url;
      let imageUrl2 = blueprint.image_url_2;
      let imageUrl3 = blueprint.image_url_3;

      // Upload new images if provided (up to 3)
      for (let i = 0; i < 3; i++) {
        const imageFile = imageFiles[i];
        const existingUrl = [blueprint.image_url, blueprint.image_url_2, blueprint.image_url_3][i];
        
        if (imageFile) {
          // Delete old image if replacing
          if (existingUrl) {
            await deleteCloudinaryImage(existingUrl);
          }

          // Upload new image
          try {
            // Images are already compressed when selected, just upload directly
            const uploadedUrl = await uploadToCloudinary(imageFile, user.id);
            
            if (i === 0) imageUrl = uploadedUrl;
            else if (i === 1) imageUrl2 = uploadedUrl;
            else if (i === 2) imageUrl3 = uploadedUrl;
          } catch (imageError) {
            throw new Error(`Image ${i + 1} upload failed: ${imageError.message}`);
          }
        }
      }

      // Update blueprint record
      const { error: dbError } = await supabase
        .from("blueprints")
        .update({
          title: titleValidation.sanitized,
          description: descriptionValidation.sanitized || null,
          file_url: fileUrl,
          image_url: imageUrl,
          image_url_2: imageUrl2,
          image_url_3: imageUrl3,
          tags: tags.length > 0 ? tags : null,
          changelog: changelogValidation.sanitized,
          updated_at: new Date().toISOString(),
        })
        .eq("id", blueprint.id);

      if (dbError) throw dbError;

      // If a new blueprint file was uploaded, send it to the parser to update materials/buildings
      if (blueprintFile) {
        try {
          console.log("Sending updated blueprint to parser...");
          const parserResponse = await sendBlueprintToParser(blueprintFile, blueprint.id);

          if (parserResponse.duplicate && parserResponse.parsed) {
            // If already parsed, update the blueprint immediately with parsed data
            console.log("Blueprint already parsed, updating database...");
            await supabase
              .from("blueprints")
              .update({
                parsed: parserResponse.parsed,
                filehash: parserResponse.fileHash,
                materials: parserResponse.parsed.Materials || {},
                buildings: parserResponse.parsed.Buildings || {},
                skills: parserResponse.parsed.SupplyItems || {},
              })
              .eq("id", blueprint.id);

            console.log("Blueprint updated with new parsed data");
          } else if (parserResponse.queued) {
            // Store the fileHash for webhook callback
            console.log("Blueprint queued for parsing, fileHash:", parserResponse.fileHash);
            await supabase
              .from("blueprints")
              .update({ filehash: parserResponse.fileHash })
              .eq("id", blueprint.id);
          }
        } catch (parserError) {
          // Parser error is non-blocking - blueprint edit is already complete
          console.error("Parser API error (non-blocking):", parserError);
        }
      }

      // Record the edit attempt in client-side rate limiter
      const clientLimiter = new ClientRateLimiter(user.id, 'edits');
      clientLimiter.recordAttempt();

      onUpdate?.();
      onClose();
    } catch (err) {
      console.error("Update error:", err);
      setError(err.message || "Failed to update blueprint");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto" style={{ backgroundImage: `linear-gradient(to bottom, ${theme.colors.elementBg}, ${theme.colors.elementBgCard})`, borderColor: theme.colors.cardBorder, borderWidth: '2px' }} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="sticky top-0 text-white p-6 flex items-center justify-between" style={{ backgroundImage: `linear-gradient(to right, ${theme.colors.headerGradientFrom}, ${theme.colors.headerGradientVia}, ${theme.colors.headerGradientTo})` }}>
          <h2 className="text-2xl font-bold" style={{ color: theme.colors.accentYellow }}>Edit Blueprint</h2>
          <button
            onClick={onClose}
            className="ml-4 p-2 hover:bg-white/10 rounded-lg transition"
            disabled={isLoading}
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6" style={{ color: theme.colors.textPrimary }}>
          {error && (
            <div className="border rounded-lg text-sm px-4 py-3" style={{ backgroundColor: `${theme.colors.cardBg}33`, borderColor: theme.colors.cardBorder, color: '#fca5a5' }}>
              {error}
            </div>
          )}

          {/* Title */}
          <div>
            <label htmlFor="edit-blueprint-title" className="block text-l font-medium mb-2" style={{ color: theme.colors.textPrimary }}>
              Blueprint Title *
            </label>
            <input
              id="edit-blueprint-title"
              name="edit-blueprint-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Advanced Smeltery Setup"
              style={{ borderColor: theme.colors.cardBorder, backgroundColor: `${theme.colors.cardBg}33`, color: `${theme.colors.textPrimary}80` }}
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 placeholder-opacity-50"
              disabled={isLoading}
            />
          </div>

          {/* Description */}
          <div>
            <label htmlFor="edit-blueprint-description" className="block text-l font-medium mb-2" style={{ color: theme.colors.textPrimary }}>
              Description
            </label>
            <textarea
              id="edit-blueprint-description"
              name="edit-blueprint-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe your blueprint..."
              rows={4}
              style={{ borderColor: theme.colors.cardBorder, backgroundColor: `${theme.colors.cardBg}33`, color: `${theme.colors.textPrimary}80` }}
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 placeholder-opacity-50"
              disabled={isLoading}
            />
          </div>

          {/* Changelog
          <div>
            <label className="block text-sm font-medium text-cyan-200 mb-2">
              What's Changed? (optional)
            </label>
            <textarea
              value={changelog}
              onChange={(e) => setChangelog(e.target.value)}
              placeholder="e.g., Fixed throughput bottleneck, improved efficiency by 20%, added new modules..."
              rows={3}
              className="w-full px-4 py-2 border border-cyan-600/50 rounded-lg focus:ring-2 focus:ring-cyan-500 bg-gray-800 text-white placeholder-gray-400"
              disabled={isLoading}
            />
          </div> */}

          {/* Blueprint File */}
          <div>
            <label className="block text-l font-medium mb-2" style={{ color: theme.colors.textPrimary }}>
              Blueprint File (.af or .png)
            </label>
            <p className="text-xs mb-2" style={{ color: theme.colors.textSecondary }}>
              {blueprintFile ? "New file selected" : "Keep existing file or upload a new one"}
            </p>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading || processingPng}
              style={{ borderColor: theme.colors.accentYellow, color: theme.colors.accentYellow }}
              className="w-full px-4 py-3 border-2 border-dashed rounded-lg transition font-medium disabled:opacity-50 hover:opacity-60"
            >
              {processingPng
                ? "Processing PNG blueprint..."
                : blueprintFile
                ? `✓ ${blueprintFile.name}`
                : "Click to select or upload .af/.png file"}
            </button>
            {compressionInfo && (
              <p style={{ color: theme.colors.textSecondary }} className="text-xs mt-1">
                PNG optimized: {formatBytes(compressionInfo.originalSize)} → {formatBytes(compressionInfo.strippedSize)} ({compressionInfo.savedSpace})
              </p>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept=".af,.png"
              onChange={handleBlueprintSelect}
              className="hidden"
              disabled={isLoading}
            />
          </div>

          {/* Images - 3 slots */}
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: theme.colors.textPrimary }}>
              Preview Images (PNG/JPG) - Up to 3
            </label>
            <div className="grid grid-cols-3 gap-3">
              {[0, 1, 2].map((index) => (
                <div key={index}>
                  {imagePreviews[index] ? (
                    <div className="relative">
                      <img
                        src={imagePreviews[index]}
                        alt={`Preview ${index + 1}`}
                        style={{ borderColor: theme.colors.cardBorder }}
                        className="w-full h-32 object-cover rounded-lg border"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const newFiles = [...imageFiles];
                          const newPreviews = [...imagePreviews];
                          const newCompressionInfo = [...imageCompressionInfo];
                          newFiles[index] = null;
                          newPreviews[index] = null;
                          newCompressionInfo[index] = null;
                          setImageFiles(newFiles);
                          setImagePreviews(newPreviews);
                          setImageCompressionInfo(newCompressionInfo);
                        }}
                        className="absolute top-1 right-1 bg-red-600 hover:bg-red-700 text-white rounded-full p-1"
                        disabled={isLoading}
                      >
                        <X className="w-3 h-3" />
                      </button>
                      {imageCompressionInfo[index] && (
                        <div className="mt-1 text-xs" style={{ color: theme.colors.textSecondary }}>
                          {imageCompressionInfo[index].fromPng ? (
                            <span>
                              Stripped: {formatBytes(imageCompressionInfo[index].originalSize)} → {formatBytes(imageCompressionInfo[index].compressedSize)}
                            </span>
                          ) : imageCompressionInfo[index].compressedSize ? (
                            <span>
                              {formatBytes(imageCompressionInfo[index].originalSize)} → {formatBytes(imageCompressionInfo[index].compressedSize)}
                            </span>
                          ) : (
                            <span>
                              {formatBytes(imageCompressionInfo[index].originalSize)}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div
                      className="relative"
                      onDragEnter={(e) => handleImageDragEnter(e, index)}
                      onDragLeave={(e) => handleImageDragLeave(e, index)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => handleImageDrop(e, index)}
                    >
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleImageSelect(e, index)}
                        className="hidden"
                        id={`image-input-${index}`}
                        disabled={isLoading}
                      />
                      <label
                        htmlFor={`image-input-${index}`}
                        style={{
                          borderColor: imageDragActive[index] ? theme.colors.cardBorder : `${theme.colors.accentYellow}`,
                          backgroundColor: imageDragActive[index] ? `${theme.colors.cardBorder}20` : `${theme.colors.cardBorder}20`,
                          color: theme.colors.textPrimary
                        }}
                        className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer transition hover:opacity-60 text-xs text-center"
                      >
                        <Upload className="w-6 h-6 mb-2" style={{ color: theme.colors.accentYellow }} />
                        <span>
                          {imageFiles[index]
                            ? imageFiles[index].name.substring(0, 15) + '...'
                            : imageDragActive[index]
                            ? "Drop here"
                            : `Image ${index + 1}`}
                        </span>
                      </label>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className="block text-l font-medium mb-2" style={{ color: theme.colors.textPrimary }}>
              Tags (up to 3)
            </label>
            <div className="flex gap-2 mb-2 flex-wrap">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="px-3 py-1 rounded-full text-sm font-medium flex items-center gap-2"
                  style={{ backgroundColor: `${theme.colors.cardBg}66`, color: theme.colors.textPrimary, borderColor: theme.colors.cardBorder, borderWidth: '1px' }}
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() => handleRemoveTag(tag)}
                    className="hover:text-red-400"
                    disabled={isLoading}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
            <div className="relative">
              <button
                type="button"
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="w-full px-4 py-2 rounded-lg border focus:outline-none focus:ring-2 text-left disabled:opacity-50"
                style={{ borderColor: theme.colors.cardBorder, backgroundColor: `${theme.colors.cardBg}33`, color: theme.colors.textPrimary }}
                disabled={isLoading || tags.length >= 3}
              >
                {tagInput || "Select tags..."}
              </button>
              {dropdownOpen && (
                <div className="absolute z-10 w-full mt-2 border rounded-lg shadow-lg max-h-64 overflow-y-auto" style={{ borderColor: theme.colors.cardBorder, backgroundColor: theme.colors.elementBg }}>
                  {AVAILABLE_TAGS.filter((tag) => !tags.includes(tag)).map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => handleSelectTag(tag)}
                      className="w-full text-left px-4 py-2 transition border-b last:border-b-0"
                      style={{ color: theme.colors.textPrimary, borderColor: `${theme.colors.cardBorder}33` }}
                      onMouseEnter={(e) => e.target.style.backgroundColor = `${theme.colors.cardBorder}33`}
                      onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Rate Limit Info */}
          {rateLimitInfo && !error && (
            <div className="border rounded-lg text-sm px-4 py-3" style={{ backgroundColor: `${theme.colors.cardBg}33`, borderColor: theme.colors.cardBorder, color: theme.colors.textSecondary }}>
              <p>📊 Edits remaining this hour: <span style={{ color: theme.colors.accentGold }} className="font-semibold">{rateLimitInfo.remaining}/{rateLimitInfo.maxAttempts}</span></p>
            </div>
          )}

          {/* Submit */}
          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              disabled={isLoading || processingPng}
              style={{
                backgroundImage: `linear-gradient(to right, ${theme.colors.buttonBg}, ${theme.colors.accentGold})`,
                color: theme.colors.buttonText
              }}
              className="flex-1 py-3 rounded-lg font-semibold transition disabled:opacity-50 flex items-center justify-center gap-2 hover:opacity-70 hover:scale-105"
            >
              {isLoading || processingState ? (
                <>
                  <Loader className="w-5 h-5 animate-spin" />
                  {processingState || "Updating..."}
                </>
              ) : (
                "Update Blueprint"
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="flex-1 py-3 rounded-lg font-semibold transition disabled:opacity-50 hover:opacity-70 hover:scale-105"
              style={{ backgroundColor: theme.colors.buttonBg, color: "text-red-500" }}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
