import { useState } from "react";
import { supabase } from "../lib/supabase";
import { stripDiscordDiscriminator } from "../lib/discordUtils";
import { validateAndSanitizeTitle, validateAndSanitizeDescription, sanitizeTitleForFilename } from "../lib/sanitization";
import { validateDescriptionUrls } from "../lib/urlProcessor";
import { generateSlug } from "../lib/slugUtils";
import { useTheme } from "../lib/ThemeContext";
import { Upload, Loader, X } from "lucide-react";
import { put } from "@vercel/blob";
import { uploadToCloudinary } from "../lib/cloudinary";
import imageCompression from "browser-image-compression";
import JSZip from "jszip";
import { m } from "framer-motion";
import { sendBlueprintToParser } from "../lib/blueprintParser";
import { transformParsedMaterials, transformParsedBuildings } from "../lib/blueprintMappings";
import { validateParsedData } from "../lib/parsedDataValidator";
import { ClientRateLimiter, checkServerRateLimit } from "../lib/rateLimiter";
import { extractBlueprintFromPng, isPngBlueprint, formatBytes } from "../lib/pngBlueprintExtractor";
import { AVAILABLE_TAGS } from "../lib/tags";
import { validateParts, getPartDisplayName } from "../lib/blueprintUtils";

// Constants for validation
const MAX_IMAGE_SIZE = 3 * 1024 * 1024; // 3MB
const MAX_IMAGE_WIDTH = 3840;
const MAX_IMAGE_HEIGHT = 2160;
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const AF_FILE_MAX_SIZE = 10 * 1024 * 1024; // 10MB
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
  // Check for double extensions or suspicious patterns
  const nameWithoutExt = fileName.slice(0, -3); // Remove .af
  const dangerousExtensions = [
    ".exe", ".bat", ".cmd", ".com", ".scr", ".vbs", ".js", ".jse",
    ".vbe", ".wsf", ".wsh", ".ps1", ".psc1", ".msh", ".msh1", ".msh1xml",
    ".mshxml", ".scf", ".pif", ".msi", ".app", ".deb", ".rpm", ".dmg",
    ".sh", ".bash", ".zsh", ".ksh", ".csh", ".run", ".bin",
    ".pdf", ".docx", ".doc", ".xls", ".xlsx", ".ppt", ".pptx", ".zip", ".rar",
    ".7z", ".tar", ".gz", ".jar", ".class", ".pyc", ".pyo"
  ];

  for (const ext of dangerousExtensions) {
    if (nameWithoutExt.endsWith(ext)) {
      return { valid: false, error: `Files with ${ext} extensions disguised as .af are not allowed` };
    }
  }

  // Check file size
  if (file.size > AF_FILE_MAX_SIZE) {
    return { valid: false, error: "Blueprint file must be smaller than 50MB" };
  }

  // Check file content (magic number check for known dangerous file types)
  try {
    // Read first 512 bytes to check for various file signatures
    const buffer = await file.slice(0, 512).arrayBuffer();
    const view = new Uint8Array(buffer);

    if (view.length >= 2) {
      // MZ header (Windows PE executable: .exe, .dll, .scr, etc.)
      if (view[0] === 0x4d && view[1] === 0x5a) {
        return { valid: false, error: "Executable files (.exe, .dll, etc.) are not allowed" };
      }

      // Shebang (Unix/Linux scripts)
      if (view[0] === 0x23 && view[1] === 0x21) {
        return { valid: false, error: "Script files are not allowed" };
      }

      // ELF header (Linux/Unix executables)
      if (view[0] === 0x7f && view[1] === 0x45 && view[2] === 0x4c && view[3] === 0x46) {
        return { valid: false, error: "Executable files are not allowed" };
      }

      // Mach-O header (macOS executables)
      if ((view[0] === 0xfe && view[1] === 0xed && view[2] === 0xfa) ||
        (view[0] === 0xca && view[1] === 0xfe && view[2] === 0xba && view[3] === 0xbe)) {
        return { valid: false, error: "Executable files are not allowed" };
      }
    }

    if (view.length >= 4) {
      // ZIP header (0x504b0304, 0x504b0506, 0x504b0708)
      if (view[0] === 0x50 && view[1] === 0x4b) {
        return { valid: false, error: "Archive files must be saved as .af files" };
      }

      // RAR header (0x526172)
      if (view[0] === 0x52 && view[1] === 0x61 && view[2] === 0x72) {
        return { valid: false, error: "Archive files (RAR) are not allowed" };
      }

      // 7z header (37 7A BC AF 27 1C)
      if (view[0] === 0x37 && view[1] === 0x7a && view[2] === 0xbc && view[3] === 0xaf) {
        return { valid: false, error: "Archive files (7z) are not allowed" };
      }

      // PDF header (%PDF)
      if (view[0] === 0x25 && view[1] === 0x50 && view[2] === 0x44 && view[3] === 0x46) {
        return { valid: false, error: "PDF files are not allowed" };
      }

      // Office Open XML files (DOCX, XLSX, PPTX - all are ZIP files)
      if (view[0] === 0x50 && view[1] === 0x4b) {
        return { valid: false, error: "Office documents and archives are not allowed" };
      }

      // RTF header ({\rtf)
      if (view[0] === 0x7b && view[1] === 0x5c && view[2] === 0x72 && view[3] === 0x74) {
        return { valid: false, error: "Rich text files are not allowed" };
      }

      // Java class file (CAFEBABE)
      if (view[0] === 0xca && view[1] === 0xfe && view[2] === 0xba && view[3] === 0xbe) {
        return { valid: false, error: "Executable files are not allowed" };
      }

      // gzip header (1f 8b)
      if (view[0] === 0x1f && view[1] === 0x8b) {
        return { valid: false, error: "Compressed archive files are not allowed" };
      }

      // tar header (ustar at offset 257)
      if (view.length >= 262 && view[257] === 0x75 && view[258] === 0x73 &&
        view[259] === 0x74 && view[260] === 0x61 && view[261] === 0x72) {
        return { valid: false, error: "Archive files (tar) are not allowed" };
      }
    }

    // Check for NUL bytes at the start, which might indicate binary executables
    if (view[0] === 0x00 && view[1] === 0x00 && view[2] === 0x00) {
      return { valid: false, error: "Suspicious binary format detected. Please ensure this is a valid .af file" };
    }
  } catch (e) {
    console.warn("Could not validate file content:", e);
    return { valid: false, error: "Failed to validate file format. Please try again" };
  }

  return { valid: true, isPng: false };
};

// Validate image file
const validateImageFile = async (file) => {
  // Check MIME type
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return {
      valid: false,
      error: `Invalid image type. Allowed: JPEG, PNG, WebP. Got: ${file.type}`
    };
  }

  // Check file size
  if (file.size > MAX_IMAGE_SIZE) {
    return {
      valid: false,
      error: `Image must be smaller than 5MB. Current: ${(file.size / 1024 / 1024).toFixed(2)}MB`
    };
  }

  // Check image dimensions
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      if (img.width > MAX_IMAGE_WIDTH || img.height > MAX_IMAGE_HEIGHT) {
        resolve({
          valid: false,
          error: `Image dimensions must be under ${MAX_IMAGE_WIDTH}x${MAX_IMAGE_HEIGHT}px. Current: ${img.width}x${img.height}px`
        });
      } else {
        resolve({ valid: true });
      }
    };
    img.onerror = () => {
      resolve({ valid: false, error: "Failed to load image. File may be corrupted." });
    };
    img.src = URL.createObjectURL(file);
  });
};

export default function BlueprintUpload({ user, onUploadSuccess, isEditMode }) {
  const { theme } = useTheme();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [productionRate, setProductionRate] = useState("");
  const [isMultiPart, setIsMultiPart] = useState(false);
  const [blueprintFile, setBlueprintFile] = useState(null);
  const [multiPartFiles, setMultiPartFiles] = useState([null, null, null, null]);
  const [multiPartDragActive, setMultiPartDragActive] = useState([false, false, false, false]);
  const [multiPartProcessing, setMultiPartProcessing] = useState([false, false, false, false]);
  const [multiPartCompressionInfo, setMultiPartCompressionInfo] = useState([null, null, null, null]);
  const [imageFiles, setImageFiles] = useState([null, null, null, null]);
  const [imagePreviews, setImagePreviews] = useState([null, null, null, null]);
  const [tags, setTags] = useState([]);
  const [tagInput, setTagInput] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [blueprintDragActive, setBlueprintDragActive] = useState(false);
  const [imageDragActive, setImageDragActive] = useState([false, false, false, false]);
  const [rateLimitInfo, setRateLimitInfo] = useState(null);
  const [processingPng, setProcessingPng] = useState(false);
  const [compressionInfo, setCompressionInfo] = useState(null);
  const [blueprintFileExtension, setBlueprintFileExtension] = useState(".af");
  const [processingState, setProcessingState] = useState("");
  const [imageCompressionInfo, setImageCompressionInfo] = useState([null, null, null, null]);

  const handleImageSelect = async (e, index) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate image before processing
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

  const handleBlueprintSelect = async (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const isPng = isPngBlueprint(file.name);
      setProcessingPng(isPng);
      setProcessingState(isPng ? "Extracting PNG..." : "Processing...");
      
      // Validate blueprint file (.af or .png)
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
          // Create an independent File from the stripped blueprint data
          // Read the blob as an array buffer to ensure a complete copy
          const strippedBuffer = await validation.strippedFile.arrayBuffer();
          const strippedBlob = new Blob([strippedBuffer], { type: 'image/png' });
          fileToUse = new File([strippedBlob], file.name, { type: 'image/png' });
          
          // Compress and populate the extracted PNG image as first preview
          if (validation.imageBlob) {
            try {
              setProcessingState("Compressing image...");
              const imageFile = new File([validation.imageBlob], 'preview.png', { type: 'image/png' });
              const originalSize = imageFile.size;
              const options = {
                maxSizeMB: 0.3,
                maxWidthOrHeight: 1500,
                useWebWorker: true,
                initialQuality: 0.55,
              };
              const compressedFile = await imageCompression(imageFile, options);
              
              // Only populate extracted image if this specific slot is empty and not in edit mode
              if (!imageFiles[0] && !isEditMode) {
                const newFiles = [...imageFiles];
                const newPreviews = [...imagePreviews];
                const newCompressionInfo = [...imageCompressionInfo];
                newFiles[0] = compressedFile;
                newPreviews[0] = URL.createObjectURL(compressedFile);
                newCompressionInfo[0] = {
                  originalSize: validation.imageBlob.size,
                  compressedSize: compressedFile.size,
                  fromPng: true
                };
                setImageFiles(newFiles);
                setImagePreviews(newPreviews);
                setImageCompressionInfo(newCompressionInfo);
              }
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

  const handleBlueprintDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setBlueprintDragActive(true);
    } else if (e.type === "dragleave") {
      setBlueprintDragActive(false);
    }
  };

  const handleBlueprintDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setBlueprintDragActive(false);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      const isPng = isPngBlueprint(file.name);
      setProcessingPng(isPng);
      setProcessingState(isPng ? "Extracting PNG..." : "Processing...");
      
      // Validate blueprint file (.af or .png)
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
          // Create an independent File from the stripped blueprint data
          // Read the blob as an array buffer to ensure a complete copy
          const strippedBuffer = await validation.strippedFile.arrayBuffer();
          const strippedBlob = new Blob([strippedBuffer], { type: 'image/png' });
          fileToUse = new File([strippedBlob], file.name, { type: 'image/png' });
          
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
              
              // Only populate extracted image if this specific slot is empty and not in edit mode
              if (!imageFiles[0] && !isEditMode) {
                const newFiles = [...imageFiles];
                const newPreviews = [...imagePreviews];
                const newCompressionInfo = [...imageCompressionInfo];
                newFiles[0] = compressedFile;
                newPreviews[0] = URL.createObjectURL(compressedFile);
                newCompressionInfo[0] = {
                  originalSize: validation.imageBlob.size,
                  compressedSize: compressedFile.size,
                  fromPng: true
                };
                setImageFiles(newFiles);
                setImagePreviews(newPreviews);
                setImageCompressionInfo(newCompressionInfo);
              }
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
      }
    }
  };

  const handleImageDrag = (e, index) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      const newDragStates = [...imageDragActive];
      newDragStates[index] = true;
      setImageDragActive(newDragStates);
    } else if (e.type === "dragleave") {
      const newDragStates = [...imageDragActive];
      newDragStates[index] = false;
      setImageDragActive(newDragStates);
    }
  };

  const handleImageDrop = async (e, index) => {
    e.preventDefault();
    e.stopPropagation();
    const newDragStates = [...imageDragActive];
    newDragStates[index] = false;
    setImageDragActive(newDragStates);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      // Validate image before processing
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

  // Multi-part blueprint handlers
  const handleMultiPartFileSelect = async (e, partIndex) => {
    const file = e.target.files?.[0];
    if (file) {
      const newStates = [...multiPartProcessing];
      newStates[partIndex] = true;
      setMultiPartProcessing(newStates);

      // Validate blueprint file
      const validation = await validateBlueprintFile(file);

      if (!validation.valid) {
        setError(validation.error);
        const newFiles = [...multiPartFiles];
        newFiles[partIndex] = null;
        setMultiPartFiles(newFiles);
        const newStates2 = [...multiPartProcessing];
        newStates2[partIndex] = false;
        setMultiPartProcessing(newStates2);
      } else {
        let fileToUse = file;
        
        if (validation.isPng) {
          // For PNG blueprints, create independent copy of stripped file (image data removed)
          const strippedBuffer = await validation.strippedFile.arrayBuffer();
          const strippedBlob = new Blob([strippedBuffer], { type: 'image/png' });
          fileToUse = new File([strippedBlob], file.name, { type: 'image/png' });
          
          // Auto-populate preview image for this part only if this specific slot is empty and not in edit mode
          if (validation.imageBlob && !imageFiles[partIndex] && !isEditMode) {
            const imageFile = new File([validation.imageBlob], `part${partIndex + 1}-preview.png`, { type: 'image/png' });
            
            // Compress the extracted image
            (async () => {
              try {
                const options = {
                  maxSizeMB: 0.3,
                  maxWidthOrHeight: 1500,
                  useWebWorker: true,
                  initialQuality: 0.55,
                };
                const compressedImage = await imageCompression(imageFile, options);
                
                const reader = new FileReader();
                reader.onload = (event) => {
                  const newImageFiles = [...imageFiles];
                  newImageFiles[partIndex] = compressedImage;
                  setImageFiles(newImageFiles);
                  
                  const newImagePreviews = [...imagePreviews];
                  newImagePreviews[partIndex] = event.target.result;
                  setImagePreviews(newImagePreviews);
                  
                  const newImageCompressionInfo = [...imageCompressionInfo];
                  newImageCompressionInfo[partIndex] = {
                    originalSize: validation.imageBlob.size,
                    compressedSize: compressedImage.size,
                    fromPng: true
                  };
                  setImageCompressionInfo(newImageCompressionInfo);
                };
                reader.readAsDataURL(compressedImage);
              } catch (compressionError) {
                console.error('Image compression failed:', compressionError);
                // Fall back to uncompressed
                const reader = new FileReader();
                reader.onload = (event) => {
                  const newImageFiles = [...imageFiles];
                  newImageFiles[partIndex] = imageFile;
                  setImageFiles(newImageFiles);
                  
                  const newImagePreviews = [...imagePreviews];
                  newImagePreviews[partIndex] = event.target.result;
                  setImagePreviews(newImagePreviews);
                  
                  const newImageCompressionInfo = [...imageCompressionInfo];
                  newImageCompressionInfo[partIndex] = {
                    originalSize: validation.imageBlob.size,
                    compressedSize: imageFile.size,
                    fromPng: true
                  };
                  setImageCompressionInfo(newImageCompressionInfo);
                };
                reader.readAsDataURL(imageFile);
              }
            })();
          }
        }

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

        const newStates = [...multiPartProcessing];
        newStates[partIndex] = false;
        setMultiPartProcessing(newStates);
      }
    }
  };

  const handleMultiPartDrag = (e, partIndex) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      const newStates = [...multiPartDragActive];
      newStates[partIndex] = true;
      setMultiPartDragActive(newStates);
    } else if (e.type === "dragleave") {
      const newStates = [...multiPartDragActive];
      newStates[partIndex] = false;
      setMultiPartDragActive(newStates);
    }
  };

  const handleMultiPartDrop = async (e, partIndex) => {
    e.preventDefault();
    e.stopPropagation();
    const newDragStates = [...multiPartDragActive];
    newDragStates[partIndex] = false;
    setMultiPartDragActive(newDragStates);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      const newStates = [...multiPartProcessing];
      newStates[partIndex] = true;
      setMultiPartProcessing(newStates);

      // Validate blueprint file
      const validation = await validateBlueprintFile(file);

      if (!validation.valid) {
        setError(validation.error);
        const newFiles = [...multiPartFiles];
        newFiles[partIndex] = null;
        setMultiPartFiles(newFiles);
        const newStates = [...multiPartProcessing];
        newStates[partIndex] = false;
        setMultiPartProcessing(newStates);
      } else {
        let fileToUse = file;
        if (validation.isPng) {
          // Create independent copy of stripped file
          const strippedBuffer = await validation.strippedFile.arrayBuffer();
          const strippedBlob = new Blob([strippedBuffer], { type: 'image/png' });
          fileToUse = new File([strippedBlob], file.name, { type: 'image/png' });
          
          // Auto-populate preview image for this part only if this specific slot is empty and not in edit mode
          if (validation.imageBlob && !imageFiles[partIndex] && !isEditMode) {
            const imageFile = new File([validation.imageBlob], `part${partIndex + 1}-preview.png`, { type: 'image/png' });
            
            // Compress the extracted image
            (async () => {
              try {
                const options = {
                  maxSizeMB: 0.3,
                  maxWidthOrHeight: 1500,
                  useWebWorker: true,
                  initialQuality: 0.55,
                };
                const compressedImage = await imageCompression(imageFile, options);
                
                const reader = new FileReader();
                reader.onload = (event) => {
                  const newImageFiles = [...imageFiles];
                  newImageFiles[partIndex] = compressedImage;
                  setImageFiles(newImageFiles);
                  
                  const newImagePreviews = [...imagePreviews];
                  newImagePreviews[partIndex] = event.target.result;
                  setImagePreviews(newImagePreviews);
                  
                  const newImageCompressionInfo = [...imageCompressionInfo];
                  newImageCompressionInfo[partIndex] = {
                    originalSize: validation.imageBlob.size,
                    compressedSize: compressedImage.size,
                    fromPng: true
                  };
                  setImageCompressionInfo(newImageCompressionInfo);
                };
                reader.readAsDataURL(compressedImage);
              } catch (compressionError) {
                console.error('Image compression failed:', compressionError);
                // Fall back to uncompressed
                const reader = new FileReader();
                reader.onload = (event) => {
                  const newImageFiles = [...imageFiles];
                  newImageFiles[partIndex] = imageFile;
                  setImageFiles(newImageFiles);
                  
                  const newImagePreviews = [...imagePreviews];
                  newImagePreviews[partIndex] = event.target.result;
                  setImagePreviews(newImagePreviews);
                  
                  const newImageCompressionInfo = [...imageCompressionInfo];
                  newImageCompressionInfo[partIndex] = {
                    originalSize: validation.imageBlob.size,
                    compressedSize: imageFile.size,
                    fromPng: true
                  };
                  setImageCompressionInfo(newImageCompressionInfo);
                };
                reader.readAsDataURL(imageFile);
              }
            })();
          }
        }

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

        const newStates = [...multiPartProcessing];
        newStates[partIndex] = false;
        setMultiPartProcessing(newStates);
      }
    }
  };

  const removeMultiPartFile = (partIndex) => {
    const newFiles = [...multiPartFiles];
    newFiles[partIndex] = null;
    setMultiPartFiles(newFiles);

    const newCompressionInfo = [...multiPartCompressionInfo];
    newCompressionInfo[partIndex] = null;
    setMultiPartCompressionInfo(newCompressionInfo);
  };

  const handleAddTag = () => {
    if (tags.length >= 5) {
      setError("Maximum of 5 tags allowed");
      return;
    }

    if (!tagInput || !AVAILABLE_TAGS.includes(tagInput)) {
      setError("Please select a valid tag from the list");
      return;
    }

    if (!tags.includes(tagInput)) {
      setTags([...tags, tagInput]);
      setTagInput("");
      setDropdownOpen(false);
      setError(null);
    }
  };

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

  const handleRemoveTag = (tag) => {
    setTags(tags.filter((t) => t !== tag));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Check rate limit first (before any validation)
    const clientLimiter = new ClientRateLimiter(user.id, 'uploads');
    const clientLimitStatus = clientLimiter.checkLimit();

    if (!clientLimitStatus.allowed) {
      setError(clientLimiter.getLimitMessage());
      setRateLimitInfo(clientLimitStatus);
      return;
    }

    // Also check server-side rate limit (per-hour limit)
    const serverLimitStatus = await checkServerRateLimit(supabase, user.id, 'uploads');
    if (!serverLimitStatus.allowed) {
      const errorMsg = `Hourly limit exceeded. You've uploaded ${serverLimitStatus.attempts} blueprints in the last hour. Maximum is ${serverLimitStatus.maxAttempts} per hour.`;
      setError(errorMsg);
      setRateLimitInfo(serverLimitStatus);
      return;
    }

    // Display rate limit info to user (how many uploads remaining)
    setRateLimitInfo(serverLimitStatus);

    // Production rate feature - Disabled for now
    const validatedProductionRate = null;

    // Validate and sanitize title
    const titleValidation = validateAndSanitizeTitle(title);
    if (!titleValidation.valid) {
      setError(titleValidation.error);
      return;
    }

    // Validate and sanitize description
    const descriptionValidation = validateAndSanitizeDescription(description);
    if (!descriptionValidation.valid) {
      setError(descriptionValidation.error);
      return;
    }

    // Validate URLs in description
    const urlValidation = validateDescriptionUrls(description);
    if (!urlValidation.valid) {
      setError(urlValidation.error);
      return;
    }

    // Multi-part or single-part validation
    if (isMultiPart) {
      // Check that at least 2 parts are selected
      const partCount = multiPartFiles.filter(f => f !== null).length;
      if (partCount < 2) {
        setError("Multi-part blueprint requires at least 2 parts");
        return;
      }
      if (partCount > 4) {
        setError("Multi-part blueprint supports maximum 4 parts");
        return;
      }
    } else {
      // Single-part mode
      if (!blueprintFile) {
        setError("Blueprint file is required");
        return;
      }
    }

    // Validate tag count
    if (tags.length > 5) {
      setError("Maximum 5 tags allowed");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      let fileUrl;
      let filesToParse = [];
      let insertData;

      if (isMultiPart) {
        // MULTI-PART BLUEPRINT HANDLING
        setProcessingState("Uploading blueprint parts...");

        // Upload each part and collect parse tasks
        const uploadedParts = [];

        for (let i = 0; i < multiPartFiles.length; i++) {
          const file = multiPartFiles[i];
          if (!file) continue;

          // Upload part file
          const partFileName = `${sanitizeTitleForFilename(title)}_part${i + 1}_${Date.now()}${file.name.endsWith('.png') ? '.png' : '.af'}`;
          const partPath = `${user.id}/${partFileName}`;
          const { error: uploadError } = await supabase.storage
            .from("blueprints")
            .upload(partPath, file);

          if (uploadError) throw uploadError;

          // Get file hash for parser
          const fileBuffer = await file.arrayBuffer();
          const hashBuffer = await crypto.subtle.digest('SHA-256', fileBuffer);
          const fileHash = Array.from(new Uint8Array(hashBuffer))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');

          uploadedParts.push({
            part_number: i + 1,
            filename: partFileName,
            file_hash: fileHash
          });

          filesToParse.push({ file, partIndex: i + 1, fileHash });
        }

        // For multi-part, we don't set a file_url (it's null)
        fileUrl = null;

        insertData = {
          title: titleValidation.sanitized,
          description: descriptionValidation.sanitized || null,
          slug: generateSlug(titleValidation.sanitized),
          user_id: user.id,
          creator_name: stripDiscordDiscriminator(user.user_metadata?.name) || "Anonymous",
          file_url: null,
          is_multi_part: true,
          parts: uploadedParts.map(p => ({
            ...p,
            parsed: null
          })),
          tags: tags.length > 0 ? tags : null,
          downloads: 0,
          likes: 0,
        };
      } else {
        // SINGLE-PART BLUEPRINT HANDLING
        setProcessingState("Uploading blueprint...");

        // Determine if file should be zipped (only for files over 100KB)
        const shouldZip = blueprintFile.size > 100 * 1024;
        const blueprintFileName = `${sanitizeTitleForFilename(title)}${blueprintFileExtension}`;

        if (shouldZip) {
          // Create zip file containing the blueprint file with compression
          const zip = new JSZip();
          zip.file(blueprintFileName, blueprintFile, { compression: "DEFLATE" });
          const zipBlob = await zip.generateAsync({
            type: "blob",
            compression: "DEFLATE",
            compressionOptions: { level: 9 }
          });

          // Upload compressed zip file
          const zipFileName = `${sanitizeTitleForFilename(title)}_${Date.now()}.zip`;
          const blueprintPath = `${user.id}/${zipFileName}`;
          const { error: blueprintError } = await supabase.storage
            .from("blueprints")
            .upload(blueprintPath, zipBlob);

          if (blueprintError) throw blueprintError;

          // Get blueprint file URL
          const { data: blueprintData } = supabase.storage
            .from("blueprints")
            .getPublicUrl(blueprintPath);
          fileUrl = blueprintData?.publicUrl;
        } else {
          // For smaller files, just upload the file directly with correct extension
          const blueprintFileNameWithTimestamp = `${sanitizeTitleForFilename(title)}_${Date.now()}${blueprintFileExtension}`;
          const blueprintPath = `${user.id}/${blueprintFileNameWithTimestamp}`;
          const { error: blueprintError } = await supabase.storage
            .from("blueprints")
            .upload(blueprintPath, blueprintFile);

          if (blueprintError) throw blueprintError;

          // Get blueprint file URL
          const { data: blueprintData } = supabase.storage
            .from("blueprints")
            .getPublicUrl(blueprintPath);
          fileUrl = blueprintData?.publicUrl;
        }

        filesToParse.push({ file: blueprintFile, partIndex: null });

        insertData = {
          title: titleValidation.sanitized,
          description: descriptionValidation.sanitized || null,
          slug: generateSlug(titleValidation.sanitized),
          user_id: user.id,
          creator_name: stripDiscordDiscriminator(user.user_metadata?.name) || "Anonymous",
          file_url: fileUrl,
          is_multi_part: false,
          tags: tags.length > 0 ? tags : null,
          downloads: 0,
          likes: 0,
        };
      }

      // Upload images if provided (up to 4 for multi-part, up to 3 for single)
      const imageUploadPromises = imageFiles.map(async (imageFile, index) => {
        if (!imageFile) return null;

        try {
          // Images are already compressed when selected, just upload directly
          return await uploadToCloudinary(imageFile, user.id);
        } catch (imageError) {
          throw new Error(`Image ${index + 1} upload failed: ${imageError.message}`);
        }
      });

      const uploadedUrls = await Promise.all(imageUploadPromises);
      insertData.image_url = uploadedUrls[0];
      insertData.image_url_2 = uploadedUrls[1];
      insertData.image_url_3 = uploadedUrls[2];
      if (isMultiPart && uploadedUrls[3]) {
        insertData.image_url_4 = uploadedUrls[3];
      }

      // Insert blueprint record into database
      setProcessingState("Creating blueprint record...");
      const { data: insertedBlueprint, error: dbError } = await supabase
        .from("blueprints")
        .insert([insertData])
        .select()
        .single();

      if (dbError) throw dbError;

      // Send files to parser API (non-blocking)
      if (insertedBlueprint?.id && filesToParse.length > 0) {
        try {
          console.log(`Sending ${filesToParse.length} file(s) to parser for blueprint:`, insertedBlueprint.id);

          // Keep track of current parts state for multi-part blueprints
          let currentParts = isMultiPart ? insertedBlueprint.parts : null;

          for (const parseTask of filesToParse) {
            const parserResponse = await sendBlueprintToParser(parseTask.file, insertedBlueprint.id);

            if (parserResponse.duplicate && parserResponse.parsed) {
              // Validate and sanitize parsed data before saving
              const validatedParsed = validateParsedData(parserResponse.parsed);
              console.log("Blueprint already parsed, updating database...");

              if (isMultiPart) {
                // Update the specific part's parsed data using current state
                const updatedParts = currentParts.map(part => {
                  if (part.part_number === parseTask.partIndex) {
                    return { ...part, parsed: validatedParsed };
                  }
                  return part;
                });

                currentParts = updatedParts; // Update local state
                await supabase
                  .from("blueprints")
                  .update({
                    parts: updatedParts,
                    filehash: parserResponse.fileHash,
                  })
                  .eq("id", insertedBlueprint.id);
              } else {
                // Single part - update parsed directly
                await supabase
                  .from("blueprints")
                  .update({
                    parsed: validatedParsed,
                    filehash: parserResponse.fileHash,
                  })
                  .eq("id", insertedBlueprint.id);
              }

              console.log("Blueprint updated with parsed data");
            } else if (parserResponse.queued) {
              // Store the fileHash for webhook callback
              console.log("Blueprint queued for parsing, fileHash:", parserResponse.fileHash);
              
              if (isMultiPart) {
                const updatedParts = currentParts.map(part => {
                  if (part.part_number === parseTask.partIndex) {
                    return { ...part, file_hash: parserResponse.fileHash };
                  }
                  return part;
                });

                currentParts = updatedParts; // Update local state
                await supabase
                  .from("blueprints")
                  .update({ parts: updatedParts })
                  .eq("id", insertedBlueprint.id);
              } else {
                await supabase
                  .from("blueprints")
                  .update({ filehash: parserResponse.fileHash })
                  .eq("id", insertedBlueprint.id);
              }
            }
          }
        } catch (parserError) {
          // Parser error is non-blocking - blueprint is already uploaded
          console.error("Parser API error (non-blocking):", parserError);
        }
      }

      // Reset form
      setTitle("");
      setDescription("");
      setProductionRate("");
      setBlueprintFile(null);
      setIsMultiPart(false);
      setMultiPartFiles([null, null, null, null]);
      setMultiPartCompressionInfo([null, null, null, null]);
      setImageFiles([null, null, null, null]);
      setImagePreviews([null, null, null, null]);
      setTags([]);
      setTagInput("");
      setRateLimitInfo(null);
      setProcessingState("");

      // Record the upload attempt in client-side rate limiter
      const clientLimiter = new ClientRateLimiter(user.id, 'uploads');
      clientLimiter.recordAttempt();

      if (onUploadSuccess) {
        onUploadSuccess();
      }
    } catch (err) {
      setError(err.message || "Failed to upload blueprint");
      console.error(err);
    } finally {
      setLoading(false);
      setProcessingState("");
    }
  };

  return (
    <div className="backdrop-blur-sm">
      <h2 style={{ color: theme.colors.accentYellow }} className="text-xl md:text-2xl font-bold mb-4 md:mb-6">Upload Your Blueprint</h2>

      <form onSubmit={handleSubmit} className="space-y-4 md:space-y-5">
        {/* Title */}
        <div>
          <label htmlFor="blueprint-title" style={{ color: theme.colors.textPrimary }} className="block text-l font-medium mb-2">
            Blueprint Title *
          </label>
          <input
            id="blueprint-title"
            name="blueprint-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g., Blast Potion 18/min"
            style={{
              borderColor: theme.colors.cardBorder,
              backgroundColor: `${theme.colors.cardBg}33`,
              color: theme.colors.textPrimary,
            }}
            className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 placeholder-opacity-50"
          />
        </div>
        {/* Description */}
        <div>
          <label htmlFor="blueprint-description" style={{ color: theme.colors.textPrimary }} className="block text-l font-medium mb-2">
            Description
          </label>
          <div className="relative">
            <textarea
              id="blueprint-description"
              name="blueprint-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows="4"
              style={{
                borderColor: theme.colors.cardBorder,
                backgroundColor: `${theme.colors.cardBg}33`,
                color: theme.colors.textPrimary,
                padding: '12px 4px',
              }}
              className="w-full border rounded-lg focus:outline-none focus:ring-2 placeholder-opacity-50"
            />
            <div
              className="absolute top-0 left-0 p-2 pointer-events-none"
              style={{
                color: `${theme.colors.textPrimary}80`,
                opacity: description ? 0 : 1,
                lineHeight: '1.8em',
                whiteSpace: 'pre-wrap',
                fontSize: '1em'
              }}
            >
              Describe your blueprint, its purpose, and any special features...{"\n"}You can include links to your blueprint plan or youtube video demonstration.{"\n"}You can include multiple images to demonstrate any complex builds.
            </div>
          </div>
        </div>

        {/* Production Rate - Disabled for now */}
        <div style={{ display: 'none' }}>
          <label htmlFor="blueprint-production-rate" style={{ color: theme.colors.textPrimary }} className="block text-l font-medium mb-2">
            Production Rate
            <span style={{ color: theme.colors.textSecondary }} className="text-sm font-normal"> (Items Per Minute) (optional)</span>
          </label>
          <input
            id="blueprint-production-rate"
            name="blueprint-production-rate"
            type="number"
            step="0.01"
            min="0"
            max="999.99"
            value={productionRate}
            onChange={(e) => setProductionRate(e.target.value)}
            placeholder="e.g., 12.5"
            style={{ borderColor: theme.colors.cardBorder, backgroundColor: `${theme.colors.cardBg}33`, color: theme.colors.textPrimary }}
            className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 placeholder-opacity-50"
          />
        </div>

        {/* Tags */}
        <div>
          <label style={{ color: theme.colors.textPrimary }} className="block text-sm font-medium mb-2">
            Tags (Select up to 5)
          </label>
          <div className="space-y-2">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <button
                  type="button"
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  style={{ borderColor: theme.colors.cardBorder, backgroundColor: `${theme.colors.cardBg}33`, color: theme.colors.textPrimary }}
                  className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 text-left flex items-center justify-between transition"
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
                        {tag}
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
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Multi-Part Mode Toggle */}
        <div>
          <label style={{ color: theme.colors.textPrimary }} className="block text-sm font-medium mb-3">
            Blueprint Type
          </label>
          <div className="flex gap-4">
            <button
              type="button"
              onClick={() => {
                setIsMultiPart(false);
                setMultiPartFiles([null, null, null, null]);
              }}
              style={{
                backgroundColor: !isMultiPart ? theme.colors.accentGold : `${theme.colors.cardBg}33`,
                color: !isMultiPart ? theme.colors.buttonText : theme.colors.textPrimary,
                borderColor: theme.colors.cardBorder,
              }}
              className="flex-1 px-4 py-2 border rounded-lg font-medium transition"
            >
              Single Blueprint
            </button>
            <button
              type="button"
              onClick={() => {
                setIsMultiPart(true);
                setBlueprintFile(null);
              }}
              style={{
                backgroundColor: isMultiPart ? theme.colors.accentGold : `${theme.colors.cardBg}33`,
                color: isMultiPart ? theme.colors.buttonText : theme.colors.textPrimary,
                borderColor: theme.colors.cardBorder,
              }}
              className="flex-1 px-4 py-2 border rounded-lg font-medium transition"
            >
              Multi-Part (2-4 parts)
            </button>
          </div>
          <p style={{ color: theme.colors.textSecondary }} className="text-xs mt-2">
            Multi-part blueprints are for builds that must be placed in multiple sections.
          </p>
        </div>

        {/* Blueprint File Upload - Single Part Mode */}
        {!isMultiPart && (
        <div>
          <label style={{ color: theme.colors.textPrimary }} className="block text-s font-medium mb-2">
            Blueprint File (.af or .png) *
            </label>
          <label style={{ color: theme.colors.textPrimary }} className="block text-xs font-medium mb-2">
            If uploading a PNG blueprint with a custom screenshot, the image will be used as the first preview image.
          </label>
          <div
            className="relative"
            onDragEnter={handleBlueprintDrag}
            onDragLeave={handleBlueprintDrag}
            onDragOver={handleBlueprintDrag}
            onDrop={handleBlueprintDrop}
          >
            <input
              type="file"
              accept=".af,.png"
              onChange={handleBlueprintSelect}
              className="hidden"
              id="blueprint-input"
            />
            <label
              htmlFor="blueprint-input"
              style={{
                borderColor: blueprintDragActive ? theme.colors.cardBorder : `${theme.colors.accentYellow}`,
                backgroundColor: blueprintDragActive ? `${theme.colors.cardBorder}20` : `${theme.colors.cardBorder}20`,
                color: theme.colors.textPrimary
              }}
              className="flex items-center justify-center w-full px-4 py-6 border-2 border-dashed rounded-lg cursor-pointer transition hover:opacity-60"
            >
              <Upload className="w-5 h-5 mr-2" style={{ color: theme.colors.accentYellow }} />
              <span>
                {processingPng
                  ? "Processing PNG blueprint..."
                  : blueprintFile
                  ? blueprintFile.name
                  : blueprintDragActive
                    ? "Drop your .af or .png file here"
                    : "Click to select or drag & drop .af/.png file"}
              </span>
            </label>
            {compressionInfo && (
              <p style={{ color: theme.colors.textSecondary }} className="text-xs mt-1">
                PNG blueprint optimized: {formatBytes(compressionInfo.originalSize)} → {formatBytes(compressionInfo.strippedSize)} ({compressionInfo.savedSpace})
              </p>
            )}
          </div>
        </div>
        )}

        {/* Blueprint File Upload - Multi-Part Mode */}
        {isMultiPart && (
        <div>
          <label style={{ color: theme.colors.textPrimary }} className="block text-sm font-medium mb-2">
            Blueprint Parts (2-4) - Select .af or .png files *
          </label>
          <p style={{ color: theme.colors.textSecondary }} className="text-xs mb-3">
            Upload each part of your multi-part blueprint. Each part will be parsed separately.
          </p>
          <div className="grid grid-cols-2 gap-3">
            {[0, 1, 2, 3].map((index) => (
              <div key={index}>
                {multiPartFiles[index] ? (
                  <div className="relative">
                    <div
                      style={{
                        backgroundColor: `${theme.colors.cardBg}33`,
                        borderColor: theme.colors.cardBorder,
                        color: theme.colors.textPrimary
                      }}
                      className="w-full px-4 py-3 border rounded-lg"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">
                            {getPartDisplayName(index + 1)} Part
                          </p>
                          <p className="text-xs" style={{ color: theme.colors.textSecondary }}>
                            {multiPartFiles[index].name.substring(0, 20)}...
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeMultiPartFile(index)}
                          className="ml-2 text-red-500 hover:text-red-600"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      {multiPartCompressionInfo[index] && (
                        <p style={{ color: theme.colors.textSecondary }} className="text-xs mt-1">
                          {multiPartCompressionInfo[index].fromPng 
                            ? `PNG optimized: ${formatBytes(multiPartCompressionInfo[index].originalSize)} → ${formatBytes(multiPartCompressionInfo[index].strippedSize)} (${multiPartCompressionInfo[index].savedSpace}%)`
                            : `File size: ${formatBytes(multiPartCompressionInfo[index].originalSize)}`
                          }
                        </p>
                      )}
                    </div>
                  </div>
                ) : (
                  <div
                    className="relative"
                    onDragEnter={(e) => handleMultiPartDrag(e, index)}
                    onDragLeave={(e) => handleMultiPartDrag(e, index)}
                    onDragOver={(e) => handleMultiPartDrag(e, index)}
                    onDrop={(e) => handleMultiPartDrop(e, index)}
                  >
                    <input
                      type="file"
                      accept=".af,.png"
                      onChange={(e) => handleMultiPartFileSelect(e, index)}
                      className="hidden"
                      id={`multipart-input-${index}`}
                    />
                    <label
                      htmlFor={`multipart-input-${index}`}
                      style={{
                        borderColor: multiPartDragActive[index] ? theme.colors.cardBorder : `${theme.colors.accentYellow}`,
                        backgroundColor: multiPartDragActive[index] ? `${theme.colors.cardBorder}20` : `${theme.colors.cardBorder}20`,
                        color: theme.colors.textPrimary
                      }}
                      className="flex flex-col items-center justify-center w-full px-4 py-6 border-2 border-dashed rounded-lg cursor-pointer transition hover:opacity-60 text-center"
                    >
                      <Upload className="w-5 h-5 mb-2" style={{ color: theme.colors.accentYellow }} />
                      <span className="text-sm">
                        {multiPartProcessing[index]
                          ? "Processing..."
                          : multiPartDragActive[index]
                            ? "Drop here"
                            : getPartDisplayName(index + 1)}
                      </span>
                    </label>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
        )}

        {/* Image Upload - 3 or 4 slots depending on multi-part mode */}
        <div>
          <label style={{ color: theme.colors.textPrimary }} className="block text-sm font-medium mb-2">
            Preview Images (PNG/JPG) - Up to {isMultiPart ? 4 : 3}
          </label>
          <div className={isMultiPart ? "grid grid-cols-4 gap-3" : "grid grid-cols-3 gap-3"}>
            {(isMultiPart ? [0, 1, 2, 3] : [0, 1, 2]).map((index) => (
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
                    >
                      <X className="w-3 h-3" />
                    </button>
                    {imageCompressionInfo[index] && (
                      <div className="mt-1 text-xs" style={{ color: theme.colors.textSecondary }}>
                        {imageCompressionInfo[index].compressedSize && imageCompressionInfo[index].compressedSize < imageCompressionInfo[index].originalSize ? (
                          <span>
                            {imageCompressionInfo[index].fromPng ? 'Extracted: ' : ''}{formatBytes(imageCompressionInfo[index].originalSize)} → {formatBytes(imageCompressionInfo[index].compressedSize)} ({Math.round((1 - imageCompressionInfo[index].compressedSize / imageCompressionInfo[index].originalSize) * 100)}%)
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
                    onDragEnter={(e) => handleImageDrag(e, index)}
                    onDragLeave={(e) => handleImageDrag(e, index)}
                    onDragOver={(e) => handleImageDrag(e, index)}
                    onDrop={(e) => handleImageDrop(e, index)}
                  >
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleImageSelect(e, index)}
                      className="hidden"
                      id={`image-input-${index}`}
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

        {/* Error Message */}
        {error && (
          <div style={{ backgroundColor: `${theme.colors.cardBg}33`, borderColor: theme.colors.cardBorder, color: '#fca5a5' }} className="p-4 border rounded-lg">
            {error}
          </div>
        )}

        {/* Rate Limit Info */}
        {rateLimitInfo && !error && (
          <div style={{ backgroundColor: `${theme.colors.cardBg}33`, borderColor: theme.colors.cardBorder, color: theme.colors.textSecondary }} className="p-4 border rounded-lg text-sm">
            <p>📊 Uploads remaining this hour: <span style={{ color: theme.colors.accentGold }} className="font-semibold">{rateLimitInfo.remaining}/{rateLimitInfo.maxAttempts}</span></p>
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading || processingPng}
          style={{
            backgroundImage: `linear-gradient(to right, ${theme.colors.buttonBg}, ${theme.colors.accentGold})`,
            color: theme.colors.buttonText
          }}
          className="w-full font-semibold py-3 rounded-lg transition flex items-center justify-center shadow-lg hover:opacity-70 hover:scale-105 disabled:opacity-50"
        >
          {loading || processingState ? (
            <>
              <Loader className="w-5 h-5 mr-2 animate-spin" />
              {processingState || "Uploading..."}
            </>
          ) : (
            <>
              <Upload className="w-5 h-5 mr-2" />
              Upload Blueprint
            </>
          )}
        </button>
      </form>
    </div>
  );
}
