import { useState, useRef } from "react";
import { createPortal } from "react-dom";
import { supabase } from "../lib/supabase";
import { stripDiscordDiscriminator } from "../lib/discordUtils";
import { validateBlueprintTitle, validateBlueprintDescription, validateDescriptionURLs, sanitizeFilename } from "../lib/validation";
import { sanitizeTitleForFilename } from "../lib/sanitization";
import { useTheme } from "../lib/ThemeContext";
import { Upload, Loader, X, FileJson, Image as ImageIcon, Package } from "lucide-react";
import { uploadToCloudinary } from "../lib/cloudinary";
import { deleteCloudinaryImage } from "../lib/cloudinaryDelete";
import imageCompression from "browser-image-compression";
import { ClientRateLimiter, checkServerRateLimit } from "../lib/rateLimiter";
import { sendBlueprintToParser } from "../lib/blueprintParser";
import { validateParsedData } from "../lib/parsedDataValidator";
import { extractBlueprintFromPng, isPngBlueprint, formatBytes } from "../lib/pngBlueprintExtractor";
import { AVAILABLE_TAGS, getTagDisplay } from "../lib/tags";
import { createIndependentBlueprintFile, populateExtractedImageForPart } from "../lib/pngBlueprintProcessor";
import { handleError } from "../lib/errorHandler";
import { ErrorAlert, SuccessAlert } from "./Alerts";
import ErrorBoundary from "./ErrorBoundary";

// Constants for validation
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_IMAGE_WIDTH = 4000;
const MAX_IMAGE_HEIGHT = 4000;
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const PNG_BLUEPRINT_MAX_SIZE = 20 * 1024 * 1024; // 20MB

// Validate blueprint file (.png) by checking extension and file structure
const validateBlueprintFile = async (file) => {
  const fileName = file.name.toLowerCase();

  if (!fileName.endsWith(".png")) {
    return { valid: false, error: "Blueprint file must be a .png file" };
  }

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

  // Check if PNG contains embedded blueprint data (detect and auto-move to blueprint slot)
  if (file.type === 'image/png') {
    try {
      const result = await extractBlueprintFromPng(file);
      if (result && result.strippedFile) {
        return {
          valid: false,
          isBlueprintFile: true,
          blueprintData: result
        };
      }
    } catch (error) {
      // Not a blueprint PNG, continue with regular validation
    }
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

function BlueprintEditContent({ blueprint, isOpen, onClose, user, onUpdate }) {
  const { theme } = useTheme();
  const [title, setTitle] = useState(blueprint?.title || "");
  const [description, setDescription] = useState(blueprint?.description || "");
  const [productionRate, setProductionRate] = useState(blueprint?.production_rate || "");
  const [changelog, setChangelog] = useState("");
  const [tags, setTags] = useState(blueprint?.tags || []);
  const [tagInput, setTagInput] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [blueprintFile, setBlueprintFile] = useState(null);
  const [imageFiles, setImageFiles] = useState([null, null, null, null]);
  const [imagePreviews, setImagePreviews] = useState([
    blueprint?.image_url || null,
    blueprint?.image_url_2 || null,
    blueprint?.image_url_3 || null,
    blueprint?.image_url_4 || null
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [imageDragActive, setImageDragActive] = useState([false, false, false, false]);
  const [rateLimitInfo, setRateLimitInfo] = useState(null);
  const [processingPng, setProcessingPng] = useState(false);
  const [compressionInfo, setCompressionInfo] = useState(null);
  const [blueprintFileExtension, setBlueprintFileExtension] = useState(".png");
  const [processingState, setProcessingState] = useState("");
  const [imageCompressionInfo, setImageCompressionInfo] = useState([null, null, null, null]);
  const [multiPartFiles, setMultiPartFiles] = useState([null, null, null, null]);
  const [multiPartCompressionInfo, setMultiPartCompressionInfo] = useState([null, null, null, null]);
  const [multiPartDragActive, setMultiPartDragActive] = useState([false, false, false, false]);
  const fileInputRef = useRef(null);
  const imageInputRef = useRef(null);
  const scrollableRef = useRef(null);

  if (!isOpen || !blueprint) return null;

  const handleSelectTag = (tag) => {
    if (tags.length >= 5) {
      setError("Maximum of 5 tags allowed");
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
        setBlueprintFileExtension(".png");
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
              
              // Don't auto-populate extracted image in edit mode to preserve user's existing screenshots
              // @!@ Needs to be improved as this is a lazy method. @!@
            } catch (compressionError) {
              console.warn('Failed to compress PNG image:', compressionError);
            }
          }
        } else {
          fileToUse = file;
        }
        setBlueprintFile(fileToUse);
        setCompressionInfo(validation.compressionInfo || null);
        setBlueprintFileExtension(".png");
        setError(null);
        setProcessingPng(false);
        setProcessingState("");
      }
    }
  };

  const handleMultiPartFileSelect = async (e, partIndex) => {
    const file = e.target.files?.[0];
    if (file) {
      const validation = await validateBlueprintFile(file);
      
      if (!validation.valid) {
        setError(validation.error);
        const newFiles = [...multiPartFiles];
        newFiles[partIndex] = null;
        setMultiPartFiles(newFiles);
      } else {
        // Create independent file from stripped data if PNG
        const fileToUse = await createIndependentBlueprintFile(validation, file);
        
        const newFiles = [...multiPartFiles];
        newFiles[partIndex] = fileToUse;
        setMultiPartFiles(newFiles);
        
        const newCompressionInfo = [...multiPartCompressionInfo];
        newCompressionInfo[partIndex] = validation.isPng ? {
          originalSize: validation.compressionInfo.originalSize,
          strippedSize: validation.compressionInfo.strippedSize,
          savedSpace: validation.compressionInfo.savedSpace,
          fromPng: true
        } : {
          originalSize: file.size,
          processedSize: fileToUse.size,
          fromPng: false
        };
        setMultiPartCompressionInfo(newCompressionInfo);
        setError(null);
      }
    }
  };

  const handleImageSelect = async (e, index) => {
    const file = e.target.files?.[0];
    if (file) {
      const validation = await validateImageFile(file);
      
      // Check if this is actually a blueprint file that was uploaded to image slot and auto move itt
      if (validation.isBlueprintFile && validation.blueprintData) {
        if (isMultiPart) {
          // In multi-part mode, move to the corresponding part
          const blueprintFile = new File([validation.blueprintData.strippedFile], file.name, { type: 'image/png' });
          const newMultiPartFiles = [...multiPartFiles];
          newMultiPartFiles[index] = blueprintFile;
          setMultiPartFiles(newMultiPartFiles);
          
          const newCompressionInfo = [...multiPartCompressionInfo];
          newCompressionInfo[index] = validation.blueprintData.compressionInfo || null;
          setMultiPartCompressionInfo(newCompressionInfo);
          
          const partName = getPartDisplayName(index + 1);
          setSuccess(`Detected a blueprint file! Automatically moved it to ${partName} Part slot.`);
        } else {
          // In single-part mode, move to blueprint file slot
          const blueprintFile = new File([validation.blueprintData.strippedFile], file.name, { type: 'image/png' });
          setBlueprintFile(blueprintFile);
          setCompressionInfo(validation.blueprintData.compressionInfo || null);
          setSuccess("Detected a blueprint file! Automatically moved it to the Blueprint File slot.");
        }
        return;
      }
      
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
      
      // Check if this is actually a blueprint file that was uploaded to image slot and auto move itt
      if (validation.isBlueprintFile && validation.blueprintData) {
        if (isMultiPart) {
          // In multi-part mode, move to the corresponding part
          const blueprintFile = new File([validation.blueprintData.strippedFile], file.name, { type: 'image/png' });
          const newMultiPartFiles = [...multiPartFiles];
          newMultiPartFiles[index] = blueprintFile;
          setMultiPartFiles(newMultiPartFiles);
          
          const newCompressionInfo = [...multiPartCompressionInfo];
          newCompressionInfo[index] = validation.blueprintData.compressionInfo || null;
          setMultiPartCompressionInfo(newCompressionInfo);
          
          const partName = getPartDisplayName(index + 1);
          setSuccess(`Detected a blueprint file! Automatically moved it to ${partName} Part slot.`);
        } else {
          // In single-part mode, move to blueprint file slot
          const blueprintFile = new File([validation.blueprintData.strippedFile], file.name, { type: 'image/png' });
          setBlueprintFile(blueprintFile);
          setCompressionInfo(validation.blueprintData.compressionInfo || null);
          setSuccess("Detected a blueprint file! Automatically moved it to the Blueprint File slot.");
        }
        return;
      }
      
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
      const descriptionValidation = validateBlueprintDescription(description);
      if (!descriptionValidation.valid) {
        throw new Error(descriptionValidation.error);
      }

      // Validate URLs in description
      const urlValidation = validateDescriptionURLs(description);
      if (!urlValidation.valid) {
        throw new Error(urlValidation.error);
      }

      // Production rate feature temporarily disabled
      const validatedProductionRate = null;

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

        const blueprintFileName = `${sanitizeTitleForFilename(title)}${blueprintFileExtension}`;

          const blueprintFileNameWithTimestamp = `${sanitizeTitleForFilename(title)}_${Date.now()}${blueprintFileExtension}`;
          const blueprintPath = `${user.id}/${blueprintFileNameWithTimestamp}`;
          const { error: blueprintError } = await supabase.storage
            .from("blueprints")
            .upload(blueprintPath, blueprintFile);

          if (blueprintError) throw blueprintError;

          const { data: blueprintData } = supabase.storage
            .from("blueprints")
            .getPublicUrl(blueprintPath);
          fileUrl = blueprintData?.publicUrl;
      }

      let imageUrl = blueprint.image_url;
      let imageUrl2 = blueprint.image_url_2;
      let imageUrl3 = blueprint.image_url_3;

      // Upload new images if provided (up to 4 for multi-part, up to 3 for single)
      const maxImages = blueprint?.is_multi_part ? 4 : 3;
      for (let i = 0; i < maxImages; i++) {
        const imageFile = imageFiles[i];
        const existingUrl = [blueprint.image_url, blueprint.image_url_2, blueprint.image_url_3, blueprint.image_url_4][i];
        
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

      // Prepare image URL 4 for multi-part blueprints
      let imageUrl4 = blueprint?.image_url_4;
      if (blueprint?.is_multi_part && imageFiles[3]) {
        if (blueprint.image_url_4) {
          await deleteCloudinaryImage(blueprint.image_url_4);
        }
        try {
          imageUrl4 = await uploadToCloudinary(imageFiles[3], user.id);
        } catch (imageError) {
          throw new Error(`Image 4 upload failed: ${imageError.message}`);
        }
      }

      // Update blueprint record
      const updateData = {
        description: descriptionValidation.sanitized || null,
        production_rate: validatedProductionRate,
        file_url: fileUrl,
        image_url: imageUrl,
        image_url_2: imageUrl2,
        image_url_3: imageUrl3,
        tags: tags.length > 0 ? tags : null,
        changelog: changelogValidation.sanitized,
        updated_at: new Date().toISOString(),
      };

      if (blueprint?.is_multi_part) {
        updateData.image_url_4 = imageUrl4;
      }

      const { error: dbError } = await supabase
        .from("blueprints")
        .update(updateData)
        .eq("id", blueprint.id);

      if (dbError) throw dbError;

      // Handle multi-part file updates
      if (blueprint?.is_multi_part && blueprint?.parts) {
        // Find which parts have been updated
        const partsToUpdate = blueprint.parts
          .map((part, idx) => multiPartFiles[idx] ? idx : null)
          .filter(idx => idx !== null);

        // Update each selected part
        for (const idx of partsToUpdate) {
          const partNumber = idx + 1;
          const partFileName = `${sanitizeTitleForFilename(title)}_part${partNumber}_${Date.now()}.png`;
          const partPath = `${user.id}/${partFileName}`;
          
          try {
            const { error: uploadError } = await supabase.storage
              .from("blueprints")
              .upload(partPath, multiPartFiles[idx]);
            
            if (uploadError) throw uploadError;

            // Calculate file hash for the updated part
            const fileBuffer = await multiPartFiles[idx].arrayBuffer();
            const hashBuffer = await crypto.subtle.digest('SHA-256', fileBuffer);
            const fileHash = Array.from(new Uint8Array(hashBuffer))
              .map(b => b.toString(16).padStart(2, '0'))
              .join('');

            // Update the specific part in the database
            const currentData = await supabase
              .from("blueprints")
              .select("parts")
              .eq("id", blueprint.id)
              .single();

            const updatedParts = currentData.data.parts.map(part => {
              if (part.part_number === partNumber) {
                return {
                  ...part,
                  filename: partFileName,
                  file_hash: fileHash,
                  parsed: null // Reset parsed data since we have a new file
                };
              }
              return part;
            });

            await supabase
              .from("blueprints")
              .update({ parts: updatedParts })
              .eq("id", blueprint.id);

            // Send updated part file to parser
            try {
              console.log(`Sending updated part ${partNumber} to parser...`);
              const parserResponse = await sendBlueprintToParser(multiPartFiles[idx], blueprint.id);

              if (parserResponse.duplicate && parserResponse.parsed) {
                // Parser has already processed this file, update it immediately
                const validatedParsed = validateParsedData(parserResponse.parsed);
                console.log(`Part ${partNumber} already parsed, updating database...`);
                
                const updatedParts2 = updatedParts.map(part => {
                  if (part.part_number === partNumber) {
                    return {
                      ...part,
                      parsed: validatedParsed
                    };
                  }
                  return part;
                });

                await supabase
                  .from("blueprints")
                  .update({ parts: updatedParts2 })
                  .eq("id", blueprint.id);

                console.log(`Part ${partNumber} updated with new parsed data`);
              } else if (parserResponse.queued) {
                // Will be updated via webhook callback
                console.log(`Part ${partNumber} queued for parsing, fileHash:`, parserResponse.fileHash);
              }
            } catch (parserError) {
              console.error(`Parser error for part ${partNumber}:`, parserError);
            }
          } catch (err) {
            throw new Error(`Failed to update blueprint part ${partNumber}: ${err.message}`);
          }
        }

        // Clear the multi-part files after update
        setMultiPartFiles([null, null, null, null]);
        setMultiPartCompressionInfo([null, null, null, null]);
      }

      // If a new blueprint file was uploaded (for single-part), send it to the parser to update materials/buildings
      if (blueprintFile && !blueprint?.is_multi_part) {
        try {
          console.log("Sending updated blueprint to parser...");
          const parserResponse = await sendBlueprintToParser(blueprintFile, blueprint.id);

          if (parserResponse.duplicate && parserResponse.parsed) {
            // Validate and sanitize parsed data before saving
            const validatedParsed = validateParsedData(parserResponse.parsed);
            console.log("Blueprint already parsed, updating database...");
            await supabase
              .from("blueprints")
              .update({
                parsed: validatedParsed,
                filehash: parserResponse.fileHash,
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

      // Pass update message to parent if blueprint data was updated
      if (blueprintFile && onUpdate) {
        onUpdate("Your blueprint has been updated! It may take a couple minutes for the changes to appear in the gallery and search results.");
      } else {
        onUpdate?.();
      }
      onClose();
    } catch (err) {
      console.error("Update error:", err);
      setError(err.message || "Failed to update blueprint");
    } finally {
      setIsLoading(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center backdrop-blur-sm px-4 py-6" onClick={onClose}>
      <div className="rounded-lg max-w-2xl w-full max-h-[calc(100vh-3rem)] overflow-hidden flex flex-col relative" style={{ backgroundImage: `linear-gradient(to bottom, ${theme.colors.elementBg}, ${theme.colors.elementBgCard})`, borderColor: theme.colors.cardBorder, borderWidth: '2px' }} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex-shrink-0 text-white px-4 py-4 md:px-6 md:py-5 flex items-center justify-between" style={{ backgroundImage: `linear-gradient(to right, ${theme.colors.headerGradientFrom}, ${theme.colors.headerGradientVia}, ${theme.colors.headerGradientTo})` }}>
          <h2 className="text-xl md:text-2xl font-bold" style={{ color: theme.colors.accentYellow }}>Edit Blueprint</h2>
          <button
            onClick={onClose}
            className="ml-4 p-1.5 md:p-2 hover:bg-white/10 rounded-lg transition"
            disabled={isLoading}
          >
            <X className="w-5 h-5 md:w-6 md:h-6" />
          </button>
        </div>

        {/* Form - Scrollable Content */}
        <div ref={scrollableRef} className="flex-1 overflow-y-auto min-h-0">
          <form onSubmit={handleSubmit} className="p-4 md:p-6 space-y-4 md:space-y-5" style={{ color: theme.colors.textPrimary }}>

          {/* Title - Read Only */}
          <div>
            <label className="block text-l font-medium mb-2" style={{ color: theme.colors.textPrimary }}>
              Blueprint Title
            </label>
            <div
              style={{ borderColor: theme.colors.cardBorder, backgroundColor: `${theme.colors.cardBg}33`, color: theme.colors.textPrimary }}
              className="w-full px-4 py-2 border rounded-lg"
            >
              {title}
            </div>
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

          {/* Production Rate - TEMPORARILY DISABLED */}
          <div style={{ display: 'none' }}>
            <label htmlFor="edit-blueprint-production-rate" className="block text-l font-medium mb-2" style={{ color: theme.colors.textPrimary }}>
              Production Rate (IPM) <span style={{ color: theme.colors.textSecondary }} className="text-sm font-normal">(optional)</span>
            </label>
            <input
              id="edit-blueprint-production-rate"
              name="edit-blueprint-production-rate"
              type="number"
              step="0.01"
              min="0"
              max="999.99"
              value={productionRate}
              onChange={(e) => setProductionRate(e.target.value)}
              placeholder="e.g., 12.5"
              style={{ borderColor: theme.colors.cardBorder, backgroundColor: `${theme.colors.cardBg}33`, color: `${theme.colors.textPrimary}80` }}
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 placeholder-opacity-50"
              disabled={isLoading}
            />
          </div>

          {/* Tags */}
          <div>
            <label className="block text-l font-medium mb-2" style={{ color: theme.colors.textPrimary }}>
              Tags (up to 5)
            </label>
            <div className="space-y-2">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <button
                    type="button"
                    onClick={() => setDropdownOpen(!dropdownOpen)}
                    style={{ borderColor: theme.colors.cardBorder, backgroundColor: `${theme.colors.cardBg}33`, color: theme.colors.textPrimary }}
                    className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 text-left flex items-center justify-between transition disabled:opacity-50"
                    disabled={isLoading || tags.length >= 5}
                  >
                    <span style={{ color: theme.colors.textPrimary }}>
                      {tagInput || "-- Select a tag --"}
                    </span>
                    <span className={`transition transform ${dropdownOpen ? "rotate-180" : ""}`}>▼</span>
                  </button>

                  {dropdownOpen && (
                    <div style={{ borderColor: theme.colors.cardBorder, backgroundColor: theme.colors.elementBg }} className="absolute top-full left-0 right-0 mt-1 border rounded-lg shadow-lg z-50 max-h-64 overflow-y-auto">
                      {AVAILABLE_TAGS.filter(tag => !tags.includes(tag)).map((tag) => (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => handleSelectTag(tag)}
                          style={{ color: theme.colors.textPrimary, borderColor: `${theme.colors.cardBorder}33` }}
                          className="w-full text-left px-4 py-2.5 transition first:rounded-t-lg last:rounded-b-lg border-b last:border-b-0"
                          onMouseEnter={(e) => e.target.style.backgroundColor = `${theme.colors.cardBorder}33`}
                          onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
                        >
                          {getTagDisplay(tag)}
                        </button>
                      ))}
                      {AVAILABLE_TAGS.filter(tag => !tags.includes(tag)).length === 0 && (
                        <div style={{ color: theme.colors.textSecondary }} className="px-4 py-2.5 text-center">
                          All tags selected
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {tags.map((tag) => (
                    <span
                      key={tag}
                      style={{ backgroundColor: `${theme.colors.cardBg}66`, color: theme.colors.textPrimary, borderColor: theme.colors.cardBorder }}
                      className="px-3 py-1 rounded-full text-sm font-medium flex items-center gap-2 border"
                    >
                      #{tag}
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
              )}
            </div>
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

          {/* Blueprint File - Only for single-part */}
          {!blueprint?.is_multi_part && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <FileJson className="w-5 h-5" style={{ color: theme.colors.accentYellow }} />
                <label className="block text-l font-medium" style={{ color: theme.colors.textPrimary }}>
                  Blueprint File (.png)
                </label>
              </div>
              <p className="text-xs mb-2" style={{ color: theme.colors.textSecondary }}>
                {blueprintFile ? "New file selected" : "Keep existing file or upload a new one"}
              </p>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isLoading || processingPng}
                style={{ borderColor: theme.colors.accentYellow, color: theme.colors.accentYellow }}
                className="w-full px-4 py-4 border-2 border-dashed rounded-lg transition font-medium disabled:opacity-50 hover:opacity-60 flex flex-col items-center justify-center min-h-[120px]"
              >
                <div className="flex flex-col gap-2 w-full items-center text-center">
                  <FileJson className="w-10 h-10" style={{ color: theme.colors.accentYellow }} />
                  <div>
                    {processingPng
                      ? "Processing PNG blueprint..."
                      : blueprintFile
                      ? `✓ ${blueprintFile.name}`
                      : "Click to select or upload .png file"}
                  </div>
                  {blueprint?.file_url && !blueprintFile && (
                    <p style={{ color: theme.colors.textSecondary }} className="text-xs break-all">
                      Current: {blueprint.file_url.split('/').pop()}
                    </p>
                  )}
                  {compressionInfo && (
                    <p style={{ color: theme.colors.textSecondary }} className="text-xs">
                      PNG optimized: {formatBytes(compressionInfo.originalSize)} → {formatBytes(compressionInfo.strippedSize)} ({compressionInfo.savedSpace}%)
                    </p>
                  )}
                </div>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".png"
                onChange={handleBlueprintSelect}
                className="hidden"
                disabled={isLoading}
              />
            </div>
          )}

          {/* Multi-Part Blueprint Files */}
          {blueprint?.is_multi_part && blueprint?.parts && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Package className="w-5 h-5" style={{ color: theme.colors.accentYellow }} />
                <label className="block text-l font-medium" style={{ color: theme.colors.textPrimary }}>
                  Update Blueprint Parts (optional)
                </label>
              </div>
              <p className="text-xs mb-3" style={{ color: theme.colors.textSecondary }}>
                Update any part files here. Only updated parts will be reprocessed.
              </p>
              <div className="grid grid-cols-2 gap-3">
                {blueprint.parts.map((part, idx) => (
                  <div key={idx}>
                    <div
                      className="relative"
                      onDragEnter={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const newDragActive = [...multiPartDragActive];
                        newDragActive[idx] = true;
                        setMultiPartDragActive(newDragActive);
                      }}
                      onDragLeave={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const newDragActive = [...multiPartDragActive];
                        newDragActive[idx] = false;
                        setMultiPartDragActive(newDragActive);
                      }}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const newDragActive = [...multiPartDragActive];
                        newDragActive[idx] = false;
                        setMultiPartDragActive(newDragActive);
                        handleMultiPartFileSelect({ target: { files: e.dataTransfer.files } }, idx);
                      }}
                    >
                      <input
                        type="file"
                        accept=".png"
                        onChange={(e) => handleMultiPartFileSelect(e, idx)}
                        className="hidden"
                        id={`multipart-edit-input-${idx}`}
                        disabled={isLoading}
                      />
                      {multiPartFiles[idx] ? (
                        <label
                          htmlFor={`multipart-edit-input-${idx}`}
                          style={{
                            borderColor: `${theme.colors.accentYellow}`,
                            backgroundColor: `${theme.colors.cardBorder}20`,
                            color: theme.colors.textPrimary,
                            minHeight: '120px'
                          }}
                          className="flex flex-col items-start justify-start w-full px-4 py-4 border-2 border-dashed rounded-lg cursor-pointer transition hover:opacity-60 text-left"
                        >
                          <div className="flex items-start justify-between w-full">
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm break-words">
                                Part {part.part_number}
                              </p>
                              <p className="text-xs break-all" style={{ color: theme.colors.textSecondary }}>
                                {multiPartFiles[idx].name}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                const newFiles = [...multiPartFiles];
                                const newCompressionInfo = [...multiPartCompressionInfo];
                                newFiles[idx] = null;
                                newCompressionInfo[idx] = null;
                                setMultiPartFiles(newFiles);
                                setMultiPartCompressionInfo(newCompressionInfo);
                              }}
                              className="ml-2 text-red-500 hover:text-red-600 flex-shrink-0"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                          {multiPartCompressionInfo[idx] && (
                            <p style={{ color: theme.colors.textSecondary }} className="text-xs mt-2 line-clamp-2">
                              {multiPartCompressionInfo[idx].fromPng
                                ? `PNG optimized: ${formatBytes(multiPartCompressionInfo[idx].originalSize)} → ${formatBytes(multiPartCompressionInfo[idx].strippedSize)} (${multiPartCompressionInfo[idx].savedSpace}%)`
                                : `File size: ${formatBytes(multiPartCompressionInfo[idx].originalSize)}`}
                            </p>
                          )}
                        </label>
                      ) : (
                        <label
                          htmlFor={`multipart-edit-input-${idx}`}
                          style={{
                            borderColor: multiPartDragActive[idx] ? theme.colors.cardBorder : `${theme.colors.accentYellow}`,
                            backgroundColor: multiPartDragActive[idx] ? `${theme.colors.cardBorder}20` : `${theme.colors.cardBorder}20`,
                            color: theme.colors.textPrimary,
                            minHeight: '120px'
                          }}
                          className="flex flex-col items-start justify-start w-full px-4 py-4 border-2 border-dashed rounded-lg cursor-pointer transition hover:opacity-60 text-left"
                        >
                          <div className="flex flex-col gap-1 w-full">
                            <FileJson className="w-8 h-8" style={{ color: theme.colors.accentYellow }} />
                            <span className="text-sm font-medium">
                              Part {part.part_number}
                            </span>
                            {part.filename && (
                              <p className="text-xs break-all" style={{ color: theme.colors.textSecondary }}>
                                Current: {part.filename}
                              </p>
                            )}
                          </div>
                        </label>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Images - 3 slots for single-part, 4 for multi-part */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <ImageIcon className="w-5 h-5" style={{ color: theme.colors.accentYellow }} />
              <label className="block text-sm font-medium" style={{ color: theme.colors.textPrimary }}>
                Preview Images (PNG/JPG) - Up to {blueprint?.is_multi_part ? "4" : "3"}
              </label>
            </div>
            <div className={`grid ${blueprint?.is_multi_part ? "grid-cols-4" : "grid-cols-3"} gap-3`}>
              {(blueprint?.is_multi_part ? [0, 1, 2, 3] : [0, 1, 2]).map((index) => (
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
                        <ImageIcon className="w-10 h-10 mb-2" style={{ color: theme.colors.accentYellow }} />
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

          {/* Rate Limit Info */}
          {rateLimitInfo && !error && (
            <div className="border rounded-lg text-sm px-4 py-3" style={{ backgroundColor: `${theme.colors.cardBg}33`, borderColor: theme.colors.cardBorder, color: theme.colors.textSecondary }}>
              <p>📊 Edits remaining this hour: <span style={{ color: theme.colors.accentGold }} className="font-semibold">{rateLimitInfo.remaining}/{rateLimitInfo.maxAttempts}</span></p>
            </div>
          )}

          <SuccessAlert message={success} onDismiss={() => setSuccess("")} />
          <ErrorAlert error={error ? { message: error } : null} onDismiss={() => setError("")} />

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
              style={{ backgroundColor: theme.colors.buttonBg, color: theme.colors.buttonText }}
            >
              Cancel
            </button>
          </div>
        </form>
        </div>
      </div>
    </div>,
    document.body
  );
}

// Wrap with error boundary
function BlueprintEdit({ blueprint, isOpen, onClose, user, onUpdate }) {
  return (
    <ErrorBoundary name="BlueprintEdit">
      <BlueprintEditContent blueprint={blueprint} isOpen={isOpen} onClose={onClose} user={user} onUpdate={onUpdate} />
    </ErrorBoundary>
  );
}

export default BlueprintEdit;
