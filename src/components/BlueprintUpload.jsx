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
import { ClientRateLimiter, checkServerRateLimit } from "../lib/rateLimiter";

// Constants for validation
const MAX_IMAGE_SIZE = 2 * 1024 * 1024; // 2MB
const MAX_IMAGE_WIDTH = 4000;
const MAX_IMAGE_HEIGHT = 4000;
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const AF_FILE_MAX_SIZE = 25 * 1024 * 1024; // 25MB

// Predefined tags list
const AVAILABLE_TAGS = [
  "logistics",
  "smelting",
  "crafting",
  "extraction",
  "enchanting",
  "brewing",
  "compact",
  "modular",
  "scalable",
  "stackable",
  "fuel",
  "currency",
  "misc",
  "experimental",
  "automation",
  "liquid",
  "relic",
  "decorative",
];

// Validate .af file by checking extension and file structure
const validateAfFile = async (file) => {
  const fileName = file.name.toLowerCase();
  
  // Check extension - must end with .af
  if (!fileName.endsWith(".af")) {
    return { valid: false, error: "File must have .af extension" };
  }

  // Check for double extensions or suspicious patterns (e.g., file.exe.af, file.pdf.af)
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

  return { valid: true };
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

export default function BlueprintUpload({ user, onUploadSuccess }) {
  const { theme } = useTheme();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [blueprintFile, setBlueprintFile] = useState(null);
  const [imageFiles, setImageFiles] = useState([null, null, null]); // Support 3 images
  const [imagePreviews, setImagePreviews] = useState([null, null, null]);
  const [tags, setTags] = useState([]);
  const [tagInput, setTagInput] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [blueprintDragActive, setBlueprintDragActive] = useState(false);
  const [imageDragActive, setImageDragActive] = useState([false, false, false]);
  const [rateLimitInfo, setRateLimitInfo] = useState(null);

  const handleImageSelect = (e, index) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate image before processing
      validateImageFile(file).then((validation) => {
        if (!validation.valid) {
          setError(validation.error);
          const newFiles = [...imageFiles];
          const newPreviews = [...imagePreviews];
          newFiles[index] = null;
          newPreviews[index] = null;
          setImageFiles(newFiles);
          setImagePreviews(newPreviews);
        } else {
          const newFiles = [...imageFiles];
          const newPreviews = [...imagePreviews];
          newFiles[index] = file;
          newPreviews[index] = URL.createObjectURL(file);
          setImageFiles(newFiles);
          setImagePreviews(newPreviews);
          setError(null);
        }
      });
    }
  };

  const handleBlueprintSelect = async (e) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate .af file
      const validation = await validateAfFile(file);
      if (!validation.valid) {
        setError(validation.error);
        setBlueprintFile(null);
      } else {
        setBlueprintFile(file);
        setError(null);
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
      // Validate .af file
      const validation = await validateAfFile(file);
      if (!validation.valid) {
        setError(validation.error);
        setBlueprintFile(null);
      } else {
        setBlueprintFile(file);
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
        newFiles[index] = null;
        newPreviews[index] = null;
        setImageFiles(newFiles);
        setImagePreviews(newPreviews);
      } else {
        const newFiles = [...imageFiles];
        const newPreviews = [...imagePreviews];
        newFiles[index] = file;
        newPreviews[index] = URL.createObjectURL(file);
        setImageFiles(newFiles);
        setImagePreviews(newPreviews);
        setError(null);
      }
    }
  };

  const handleAddTag = () => {
    if (tags.length >= 3) {
      setError("Maximum of 3 tags allowed");
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
    
    if (!blueprintFile) {
      setError("Blueprint file is required");
      return;
    }

    // Validate tag count
    if (tags.length > 3) {
      setError("Maximum 3 tags allowed");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Determine if file should be zipped (only for files over 100KB)
      const shouldZip = blueprintFile.size > 100 * 1024;
      const afFileName = `${sanitizeTitleForFilename(title)}.af`;
      let fileUrl;

      if (shouldZip) {
        // Create zip file containing the blueprint file with compression
        const zip = new JSZip();
        zip.file(afFileName, blueprintFile, { compression: "DEFLATE" });
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
        // For smaller files, just upload renamed .af file directly
        const afFileNameWithTimestamp = `${sanitizeTitleForFilename(title)}_${Date.now()}.af`;
        const blueprintPath = `${user.id}/${afFileNameWithTimestamp}`;
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

      let imageUrl = null;
      let imageUrl2 = null;
      let imageUrl3 = null;

      // Upload images if provided (up to 3)
      const imageUploadPromises = imageFiles.map(async (imageFile, index) => {
        if (!imageFile) return null;
        
        try {
          // Compress image
          const options = {
            maxSizeMB: 0.3,
            maxWidthOrHeight: 1500,
            useWebWorker: true,
            quality: 0.55,
          };
          const compressedFile = await imageCompression(imageFile, options);
          
          // Upload to Cloudinary
          return await uploadToCloudinary(compressedFile, user.id);
        } catch (imageError) {
          throw new Error(`Image ${index + 1} upload failed: ${imageError.message}`);
        }
      });

      const uploadedUrls = await Promise.all(imageUploadPromises);
      imageUrl = uploadedUrls[0];
      imageUrl2 = uploadedUrls[1];
      imageUrl3 = uploadedUrls[2];

      // Insert blueprint record into database using sanitized data
      const slug = generateSlug(titleValidation.sanitized);
      
      const { data: insertedBlueprint, error: dbError } = await supabase
        .from("blueprints")
        .insert([
          {
            title: titleValidation.sanitized,
            description: descriptionValidation.sanitized || null,
            slug: slug,
            user_id: user.id,
            creator_name: stripDiscordDiscriminator(user.user_metadata?.name) || "Anonymous",
            file_url: fileUrl,
            image_url: imageUrl,
            image_url_2: imageUrl2,
            image_url_3: imageUrl3,
            tags: tags.length > 0 ? tags : null,
            downloads: 0,
            likes: 0,
          },
        ])
        .select()
        .single();

      if (dbError) throw dbError;

      // Send blueprint to parser API (non-blocking)
      if (insertedBlueprint?.id) {
        try {
          console.log("Sending blueprint to parser...");
          const parserResponse = await sendBlueprintToParser(blueprintFile, insertedBlueprint.id);
          
          if (parserResponse.duplicate && parserResponse.parsed) {
            // If already parsed, update the blueprint immediately with parsed data
            console.log("Blueprint already parsed, updating database...");
            const materials = transformParsedMaterials(parserResponse.parsed.Materials);
            const buildings = transformParsedBuildings(parserResponse.parsed.Buildings);
            
            await supabase
              .from("blueprints")
              .update({
                parsed: parserResponse.parsed,
                filehash: parserResponse.fileHash,
                materials: parserResponse.parsed.Materials || {},
                buildings: parserResponse.parsed.Buildings || {},
                skills: parserResponse.parsed.SupplyItems || {},
              })
              .eq("id", insertedBlueprint.id);
            
            console.log("Blueprint updated with parsed data");
          } else if (parserResponse.queued) {
            // Store the fileHash for webhook callback
            console.log("Blueprint queued for parsing, fileHash:", parserResponse.fileHash);
            await supabase
              .from("blueprints")
              .update({ filehash: parserResponse.fileHash })
              .eq("id", insertedBlueprint.id);
          }
        } catch (parserError) {
          // Parser error is non-blocking - blueprint is already uploaded
          console.error("Parser API error (non-blocking):", parserError);
        }
      }

      // Reset form
      setTitle("");
      setDescription("");
      setBlueprintFile(null);
      setImageFiles([null, null, null]);
      setImagePreviews([null, null, null]);
      setTags([]);
      setTagInput("");
      setRateLimitInfo(null);
      
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
    }
  };

  return (
    <div className="backdrop-blur-sm">
      <h2 style={{ color: theme.colors.accentYellow }} className="text-2xl font-bold mb-6">Upload Your Blueprint</h2>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Title */}
        <div>
          <label style={{ color: theme.colors.textPrimary }} className="block text-l font-medium mb-2">
            Blueprint Title *
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g., Efficient Iron Production Setup"
            style={{ borderColor: theme.colors.cardBorder, backgroundColor: `${theme.colors.cardBg}33`, color: theme.colors.textPrimary }}
            className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 placeholder-opacity-50"
          />
        </div>

        {/* Description */}
        <div>
          <label style={{ color: theme.colors.textPrimary }} className="block text-l font-medium mb-2">
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe your blueprint, its purpose, and any special features..."
            rows="4"
            style={{ borderColor: theme.colors.cardBorder, backgroundColor: `${theme.colors.cardBg}33`, color: theme.colors.textPrimary }}
            className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 placeholder-opacity-50"
          />
        </div>

        {/* Tags */}
        <div>
          <label style={{ color: theme.colors.textPrimary }} className="block text-sm font-medium mb-2">
            Tags (Select up to 3)
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

        {/* Blueprint File Upload */}
        <div>
          <label style={{ color: theme.colors.textPrimary }} className="block text-s font-medium mb-2">
            Blueprint File (.af) *
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
              accept=".af"
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
                {blueprintFile
                  ? blueprintFile.name
                  : blueprintDragActive
                  ? "Drop your .af file here"
                  : "Click to select or drag & drop .af file"}
              </span>
            </label>
          </div>
        </div>

        {/* Image Upload - 3 slots */}
        <div>
          <label style={{ color: theme.colors.textPrimary }} className="block text-sm font-medium mb-2">
            Preview Images (PNG/JPG) - Up to 3
          </label>
          <div className="grid grid-cols-3 gap-3">
            {[0, 1, 2].map((index) => (
              <div key={index} className="space-y-2">
                {imagePreviews[index] && (
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
                        newFiles[index] = null;
                        newPreviews[index] = null;
                        setImageFiles(newFiles);
                        setImagePreviews(newPreviews);
                      }}
                      className="absolute top-1 right-1 bg-red-600 hover:bg-red-700 text-white rounded-full p-1"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                )}
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
                    className="flex flex-col items-center justify-center w-full px-2 py-4 border-2 border-dashed rounded-lg cursor-pointer transition hover:opacity-60 text-xs text-center"
                  >
                    <Upload className="w-4 h-4 mb-1" style={{ color: theme.colors.accentYellow }} />
                    <span>
                      {imageFiles[index]
                        ? imageFiles[index].name.substring(0, 15) + '...'
                        : imageDragActive[index]
                        ? "Drop here"
                        : `Image ${index + 1}`}
                    </span>
                  </label>
                </div>
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
          disabled={loading}
          style={{
            backgroundImage: `linear-gradient(to right, ${theme.colors.buttonBg}, ${theme.colors.accentGold})`,
            color: theme.colors.buttonText
          }}
          className="w-full font-semibold py-3 rounded-lg transition flex items-center justify-center shadow-lg hover:opacity-70 hover:scale-105 disabled:opacity-50"
        >
          {loading ? (
            <>
              <Loader className="w-5 h-5 mr-2 animate-spin" />
              Uploading...
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
