import { useState } from "react";
import { supabase } from "../lib/supabase";
import { stripDiscordDiscriminator } from "../lib/discordUtils";
import { validateAndSanitizeTitle, validateAndSanitizeDescription, sanitizeTitleForFilename } from "../lib/sanitization";
import { Upload, Loader, X } from "lucide-react";
import { put } from "@vercel/blob";
import imageCompression from "browser-image-compression";
import JSZip from "jszip";
import { m } from "framer-motion";

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
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [blueprintFile, setBlueprintFile] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [tags, setTags] = useState([]);
  const [tagInput, setTagInput] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [blueprintDragActive, setBlueprintDragActive] = useState(false);
  const [imageDragActive, setImageDragActive] = useState(false);

  const handleImageSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate image before processing
      validateImageFile(file).then((validation) => {
        if (!validation.valid) {
          setError(validation.error);
          setImageFile(null);
          setImagePreview(null);
        } else {
          setImageFile(file);
          setImagePreview(URL.createObjectURL(file));
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

  const handleImageDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setImageDragActive(true);
    } else if (e.type === "dragleave") {
      setImageDragActive(false);
    }
  };

  const handleImageDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setImageDragActive(false);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      // Validate image before processing
      const validation = await validateImageFile(file);
      if (!validation.valid) {
        setError(validation.error);
        setImageFile(null);
        setImagePreview(null);
      } else {
        setImageFile(file);
        setImagePreview(URL.createObjectURL(file));
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

      // Upload image if provided (using Vercel Blob for automatic optimization)
      if (imageFile) {
        try {
          // Compress image
          const options = {
            maxSizeMB: 0.3,
            maxWidthOrHeight: 1500,
            useWebWorker: true,
            quality: 0.55,
          };
          const compressedFile = await imageCompression(imageFile, options);
          
          const blobResult = await put(`blueprint-images/${user.id}/${Date.now()}_${imageFile.name}`, compressedFile, {
            access: "public",
            token: import.meta.env.VITE_BLOB_READ_WRITE_TOKEN,
          });
          imageUrl = blobResult.url;
        } catch (imageError) {
          throw new Error(`Image upload failed: ${imageError.message}`);
        }
      }

      // Insert blueprint record into database using sanitized data
      const { error: dbError } = await supabase.from("blueprints").insert([
        {
          title: titleValidation.sanitized,
          description: descriptionValidation.sanitized || null,
          user_id: user.id,
          creator_name: stripDiscordDiscriminator(user.user_metadata?.name) || "Anonymous",
          file_url: fileUrl,
          image_url: imageUrl,
          tags: tags.length > 0 ? tags : null,
          downloads: 0,
          likes: 0,
        },
      ]);

      if (dbError) throw dbError;

      // Reset form
      setTitle("");
      setDescription("");
      setBlueprintFile(null);
      setImageFile(null);
      setImagePreview(null);
      setTags([]);
      setTagInput("");

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
      <h2 className="text-2xl font-bold text-amber-300 mb-6">Upload Your Blueprint</h2>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Title */}
        <div>
          <label className="block text-sm font-medium text-amber-300 mb-2">
            Blueprint Title *
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g., Efficient Iron Production Setup"
            className="w-full px-4 py-2 border border-cyan-700/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 bg-gray-800/50 text-gray-100 placeholder-gray-500"
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-amber-300 mb-2">
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe your blueprint, its purpose, and any special features..."
            rows="4"
            className="w-full px-4 py-2 border border-cyan-700/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 bg-gray-800/50 text-gray-100 placeholder-gray-500"
          />
        </div>

        {/* Tags */}
        <div>
          <label className="block text-sm font-medium text-amber-300 mb-2">
            Tags (Select up to 3)
          </label>
          <div className="space-y-2">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <button
                  type="button"
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="w-full px-4 py-2 border border-cyan-700/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 bg-gray-800/50 text-gray-100 text-left flex items-center justify-between hover:border-cyan-600/70 transition"
                >
                  <span className={tagInput ? "text-gray-100" : "text-gray-500"}>
                    {tagInput || "-- Select a tag --"}
                  </span>
                  <span className={`transition transform ${dropdownOpen ? "rotate-180" : ""}`}>▼</span>
                </button>
                
                {dropdownOpen && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-gray-800 border border-cyan-700/50 rounded-lg shadow-lg z-50 max-h-64 overflow-y-auto">
                    {AVAILABLE_TAGS.filter(tag => !tags.includes(tag)).map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => handleSelectTag(tag)}
                        className="w-full text-left px-4 py-2.5 hover:bg-cyan-900/40 text-gray-100 transition first:rounded-t-lg last:rounded-b-lg border-b border-cyan-700/20 last:border-b-0"
                      >
                        {tag}
                      </button>
                    ))}
                    {AVAILABLE_TAGS.filter(tag => !tags.includes(tag)).length === 0 && (
                      <div className="px-4 py-2.5 text-gray-500 text-center">
                        All tags selected
                      </div>
                    )}
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={handleAddTag}
                disabled={tags.length >= 3 || !tagInput}
                className="px-4 py-2 bg-gradient-to-r from-amber-600 to-yellow-600 hover:from-amber-500 hover:to-yellow-500 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed text-black rounded-lg font-semibold transition"
              >
                Add
              </button>
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="bg-cyan-700/50 text-amber-300 px-3 py-1 rounded-full text-sm font-medium flex items-center gap-2 border border-purple-600/50"
                  >
                    #{tag}
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(tag)}
                      className="hover:text-amber-200"
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
          <label className="block text-sm font-medium text-amber-300 mb-2">
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
              className={`flex items-center justify-center w-full px-4 py-6 border-2 border-dashed rounded-lg cursor-pointer transition ${
                blueprintDragActive
                  ? "border-cyan-500 bg-cyan-900/30 text-cyan-300"
                  : "border-cyan-700/50 hover:border-cyan-600/70 hover:bg-cyan-900/10 text-gray-300"
              }`}
            >
              <Upload className="w-5 h-5 mr-2 text-amber-400" />
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

        {/* Image Upload */}
        <div>
          <label className="block text-sm font-medium text-amber-300 mb-2">
            Preview Image (PNG/JPG)
          </label>
          <div className="space-y-3">
            {imagePreview && (
              <img
                src={imagePreview}
                alt="Preview"
                className="w-full h-48 object-cover rounded-lg border border-cyan-700/50"
              />
            )}
            <div
              className="relative"
              onDragEnter={handleImageDrag}
              onDragLeave={handleImageDrag}
              onDragOver={handleImageDrag}
              onDrop={handleImageDrop}
            >
              <input
                type="file"
                accept="image/*"
                onChange={handleImageSelect}
                className="hidden"
                id="image-input"
              />
              <label
                htmlFor="image-input"
                className={`flex items-center justify-center w-full px-4 py-6 border-2 border-dashed rounded-lg cursor-pointer transition ${
                  imageDragActive
                    ? "border-cyan-500 bg-cyan-900/30 text-cyan-300"
                    : "border-cyan-700/50 hover:border-cyan-600/70 hover:bg-cyan-900/10 text-gray-300"
                }`}
              >
                <Upload className="w-5 h-5 mr-2 text-amber-400" />
                <span>
                  {imageFile
                    ? imageFile.name
                    : imageDragActive
                    ? "Drop your image here"
                    : "Click to select or drag & drop image"}
                </span>
              </label>
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="p-4 bg-red-900/30 border border-red-700/50 text-red-300 rounded-lg">
            {error}
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-gradient-to-r from-amber-600 to-yellow-600 hover:from-amber-500 hover:to-yellow-500 disabled:from-gray-600 disabled:to-gray-700 text-black font-semibold py-3 rounded-lg transition flex items-center justify-center shadow-lg"
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
