import { useState, useRef } from "react";
import { supabase } from "../lib/supabase";
import { stripDiscordDiscriminator } from "../lib/discordUtils";
import { validateAndSanitizeTitle, validateAndSanitizeDescription, validateAndSanitizeChangelog, sanitizeTitleForFilename } from "../lib/sanitization";
import { Upload, Loader, X } from "lucide-react";
import { put, del as blobDelete } from "@vercel/blob";
import imageCompression from "browser-image-compression";
import JSZip from "jszip";

// Constants for validation
const MAX_IMAGE_SIZE = 4 * 1024 * 1024; // 4MB
const MAX_IMAGE_WIDTH = 4000;
const MAX_IMAGE_HEIGHT = 4000;
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const AF_FILE_MAX_SIZE = 50 * 1024 * 1024; // 50MB

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
  if (!file.name.toLowerCase().endsWith(".af")) {
    return { valid: false, error: "File must have .af extension" };
  }

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
  const [title, setTitle] = useState(blueprint?.title || "");
  const [description, setDescription] = useState(blueprint?.description || "");
  const [changelog, setChangelog] = useState("");
  const [tags, setTags] = useState(blueprint?.tags || []);
  const [tagInput, setTagInput] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [blueprintFile, setBlueprintFile] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(blueprint?.image_url || null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [imageDragActive, setImageDragActive] = useState(false);
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

  const handleImageSelect = async (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const validation = await validateImageFile(file);
      if (!validation.valid) {
        setError(validation.error);
        setImageFile(null);
        setImagePreview(blueprint?.image_url);
      } else {
        setImageFile(file);
        setImagePreview(URL.createObjectURL(file));
        setError(null);
      }
    }
  };

  const handleImageDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setImageDragActive(true);
  };

  const handleImageDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setImageDragActive(false);
  };

  const handleImageDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setImageDragActive(false);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      const validation = await validateImageFile(file);
      if (!validation.valid) {
        setError(validation.error);
        setImageFile(null);
        setImagePreview(blueprint?.image_url);
      } else {
        setImageFile(file);
        setImagePreview(URL.createObjectURL(file));
        setError(null);
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
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
        // Rename the .af file to the blueprint title before zipping
        const afFileName = `${sanitizeTitleForFilename(title)}.af`;
        
        const zip = new JSZip();
        zip.file(afFileName, blueprintFile, { compression: "DEFLATE" });
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

      // Upload new image if provided
      if (imageFile) {
        // Delete old image if it exists BEFORE uploading new one
        if (blueprint.image_url) {
          try {
            // For Vercel Blob, use the full URL to delete
            await blobDelete(blueprint.image_url, {
              token: import.meta.env.VITE_BLOB_READ_WRITE_TOKEN,
            });
          } catch (delError) {
            console.warn("Could not delete old image from blob storage:", delError);
          }
        }

        // Upload new image
        try {
          const options = {
            maxSizeMB: 0.3,
            maxWidthOrHeight: 2000,
            useWebWorker: true,
            quality: 0.75,
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

      // Update blueprint record
      const { error: dbError } = await supabase
        .from("blueprints")
        .update({
          title: titleValidation.sanitized,
          description: descriptionValidation.sanitized || null,
          file_url: fileUrl,
          image_url: imageUrl,
          tags: tags.length > 0 ? tags : null,
          changelog: changelogValidation.sanitized,
          updated_at: new Date().toISOString(),
        })
        .eq("id", blueprint.id);

      if (dbError) throw dbError;

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
      <div className="bg-gradient-to-b from-[#b99a77] to-[#876e54] rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto border-2 border-[#cfb153]" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-[#a78158] via-[#9f7f5a] to-[#9b7956] text-white p-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-[#fcd34d]">Edit Blueprint</h2>
          <button
            onClick={onClose}
            className="ml-4 p-2 hover:bg-white/10 rounded-lg transition"
            disabled={isLoading}
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6 text-[#fcd34d]">
          {error && (
            <div className="bg-red-900/30 border border-red-700/50 text-red-200 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Title */}
          <div>
            <label className="block text-l font-medium mb-2">
              Blueprint Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Advanced Smeltery Setup"
              className="w-full px-4 py-2 border border-[#87725a]/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#bba664] bg-[#6f5d45]/50 text-[#ffdca7] placeholder-[#ffdca7]"
              disabled={isLoading}
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-l font-medium mb-2">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe your blueprint..."
              rows={4}
              className="w-full px-4 py-2 border border-[#87725a]/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#bba664] bg-[#6f5d45]/50 text-[#ffdca7] placeholder-[#ffdca7]"
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
            <label className="block text-l font-medium mb-2">
              Blueprint File (.af)
            </label>
            <p className="text-xs mb-2">
              {blueprintFile ? "New file selected" : "Keep existing file or upload a new one"}
            </p>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading}
              className="w-full px-4 py-3 border-2 border-dashed border-[#fcd34d]/50 hover:border-[#ffd39c]/70 hover:bg-[#6f5d45]/50 rounded-lg transition font-medium disabled:opacity-50"
            >
              {blueprintFile ? `✓ ${blueprintFile.name}` : "Click to select or upload .af file"}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".af"
              onChange={handleBlueprintSelect}
              className="hidden"
              disabled={isLoading}
            />
          </div>

          {/* Image */}
          <div>
            <label className="block text-l font-medium mb-2">
              Preview Image (optional)
            </label>
            <div
              onDragEnter={handleImageDragEnter}
              onDragLeave={handleImageDragLeave}
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleImageDrop}
              className={`border-2 border-dashed rounded-lg p-6 text-center transition cursor-pointer ${
                imageDragActive
                  ? "border-[#bba664] bg-[#977958]/30"
                  : "border-[#fcd34d]/50 hover:border-[#ffd39c]/70 hover:bg-[#6f5d45]/50"
              } ${isLoading ? "opacity-50" : ""}`}
              onClick={() => imageInputRef.current?.click()}
            >
              {imagePreview && !imageFile ? (
                <>
                  <img
                    src={imagePreview}
                    alt="Current preview"
                    className="w-24 h-24 object-cover rounded-lg mx-auto mb-2"
                  />
                  <p className="text-sm">Click to change image</p>
                </>
              ) : (
                <>
                  <Upload className="w-8 h-8 mx-auto mb-2" />
                  <p className="font-medium">
                    {imageFile ? `✓ ${imageFile.name}` : "Drag image here or click to select"}
                  </p>
                  <p className="text-xs">PNG, JPEG, or WebP • Max 5MB</p>
                </>
              )}
            </div>
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageSelect}
              className="hidden"
              disabled={isLoading}
            />
          </div>

          {/* Tags */}
          <div>
            <label className="block text-l font-medium mb-2">
              Tags (up to 3)
            </label>
            <div className="flex gap-2 mb-2 flex-wrap">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="bg-[#6f5d45]/50 text-[#ffdca7] px-3 py-1 rounded-full text-sm font-medium flex items-center gap-2 border border-[#87725a]/50"
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
                className="w-full px-4 py-2 rounded-lg border border-[#87725a]/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#bba664] bg-[#6f5d45]/50 text-[#ffdca7] text-left disabled:opacity-50"
                disabled={isLoading || tags.length >= 3}
              >
                {tagInput || "Select tags..."}
              </button>
              {dropdownOpen && (
                <div className="absolute z-10 w-full mt-2 bg-[#6f5d45] border border-[#87725a]/50 rounded-lg shadow-lg max-h-64 overflow-y-auto">
                  {AVAILABLE_TAGS.filter((tag) => !tags.includes(tag)).map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => handleSelectTag(tag)}
                      className="w-full text-left px-4 py-2 hover:bg-[#977958]/40 text-[#ffdca7] transition border-b border-[#87725a]/20 last:border-b-0"
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Submit */}
          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 bg-gradient-to-r from-[#d1a94f] to-[#ddb52c] hover:from-amber-500 hover:to-yellow-500 text-white py-3 rounded-lg font-semibold transition disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader className="w-5 h-5 animate-spin" />
                  Updating...
                </>
              ) : (
                "Update Blueprint"
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="flex-1 bg-[#59452e] text-white py-3 rounded-lg font-semibold hover:bg-red-900/40 transition disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
