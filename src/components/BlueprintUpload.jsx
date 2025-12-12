import { useState } from "react";
import { supabase } from "../lib/supabase";
import { Upload, Loader, X } from "lucide-react";
import { put } from "@vercel/blob";
import imageCompression from "browser-image-compression";
import JSZip from "jszip";

// Constants for validation
const MAX_IMAGE_SIZE = 4 * 1024 * 1024; // 4MB
const MAX_IMAGE_WIDTH = 4000;
const MAX_IMAGE_HEIGHT = 4000;
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const AF_FILE_MAX_SIZE = 50 * 1024 * 1024; // 50MB

// Validate .af file by checking extension and file structure
const validateAfFile = async (file) => {
  // Check extension
  if (!file.name.toLowerCase().endsWith(".af")) {
    return { valid: false, error: "File must have .af extension" };
  }

  // Check file size
  if (file.size > AF_FILE_MAX_SIZE) {
    return { valid: false, error: "Blueprint file must be smaller than 50MB" };
  }

  // Check file content (basic magic number check for common archives/executables)
  try {
    const buffer = await file.slice(0, 4).arrayBuffer();
    const view = new Uint8Array(buffer);
    
    // Reject common executable signatures
    if (view.length >= 2) {
      // MZ header (PE executable)
      if (view[0] === 0x4d && view[1] === 0x5a) {
        return { valid: false, error: "Executable files are not allowed" };
      }
      // Shebang (Unix scripts)
      if (view[0] === 0x23 && view[1] === 0x21) {
        return { valid: false, error: "Script files are not allowed" };
      }
    }
    if (view.length >= 4) {
      // ZIP header (0x504b0304)
      if (view[0] === 0x50 && view[1] === 0x4b && view[2] === 0x03 && view[3] === 0x04) {
        return { valid: false, error: "Archive files must be saved as .af files" };
      }
    }
  } catch (e) {
    // If we can't read the file, still allow it (might be a valid .af)
    console.warn("Could not validate file content:", e);
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

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

  const handleAddTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags([...tags, tagInput.trim()]);
      setTagInput("");
    }
  };

  const handleRemoveTag = (tag) => {
    setTags(tags.filter((t) => t !== tag));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title || !blueprintFile) {
      setError("Title and blueprint file are required");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Create zip file containing the blueprint file
      const zip = new JSZip();
      zip.file(blueprintFile.name, blueprintFile);
      const zipBlob = await zip.generateAsync({ type: "blob" });

      // Upload compressed zip file
      const zipFileName = blueprintFile.name.replace(".af", "") + ".zip";
      const blueprintPath = `${user.id}/${Date.now()}_${zipFileName}`;
      const { error: blueprintError } = await supabase.storage
        .from("blueprints")
        .upload(blueprintPath, zipBlob);

      if (blueprintError) throw blueprintError;

      // Get blueprint file URL
      const { data: blueprintData } = supabase.storage
        .from("blueprints")
        .getPublicUrl(blueprintPath);
      const fileUrl = blueprintData?.publicUrl;

      let imageUrl = null;

      // Upload image if provided (using Vercel Blob for automatic optimization)
      if (imageFile) {
        try {
          // Compress image to ensure it's under 300KB
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

      // Insert blueprint record into database
      const { error: dbError } = await supabase.from("blueprints").insert([
        {
          title,
          description: description || null,
          user_id: user.id,
          creator_name: user.user_metadata?.name || "Anonymous",
          file_url: fileUrl,
          image_url: imageUrl,
          tags: tags.length > 0 ? tags : null,
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
    <div className="bg-gradient-to-br from-indigo-900/30 to-purple-900/30 rounded-lg shadow-lg p-8 border border-purple-700/50 backdrop-blur-sm">
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
            className="w-full px-4 py-2 border border-purple-700/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 bg-gray-800/50 text-gray-100 placeholder-gray-500"
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
            className="w-full px-4 py-2 border border-purple-700/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 bg-gray-800/50 text-gray-100 placeholder-gray-500"
          />
        </div>

        {/* Tags */}
        <div>
          <label className="block text-sm font-medium text-amber-300 mb-2">
            Tags
          </label>
          <div className="space-y-2">
            <div className="flex gap-2">
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && (e.preventDefault(), handleAddTag())}
                placeholder="e.g., iron, production, efficient"
                className="flex-1 px-4 py-2 border border-purple-700/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 bg-gray-800/50 text-gray-100 placeholder-gray-500"
              />
              <button
                type="button"
                onClick={handleAddTag}
                className="px-4 py-2 bg-gradient-to-r from-amber-600 to-yellow-600 hover:from-amber-500 hover:to-yellow-500 text-black rounded-lg font-semibold transition"
              >
                Add
              </button>
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="bg-purple-700/50 text-amber-300 px-3 py-1 rounded-full text-sm font-medium flex items-center gap-2 border border-purple-600/50"
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
          <div className="relative">
            <input
              type="file"
              accept=".af"
              onChange={handleBlueprintSelect}
              className="hidden"
              id="blueprint-input"
            />
            <label
              htmlFor="blueprint-input"
              className="flex items-center justify-center w-full px-4 py-3 border-2 border-dashed border-purple-700/50 rounded-lg cursor-pointer hover:bg-purple-900/20 transition"
            >
              <Upload className="w-5 h-5 mr-2 text-amber-400" />
              <span className="text-gray-300">
                {blueprintFile ? blueprintFile.name : "Click to select .af file"}
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
                className="w-full h-48 object-cover rounded-lg border border-purple-700/50"
              />
            )}
            <div className="relative">
              <input
                type="file"
                accept="image/*"
                onChange={handleImageSelect}
                className="hidden"
                id="image-input"
              />
              <label
                htmlFor="image-input"
                className="flex items-center justify-center w-full px-4 py-3 border-2 border-dashed border-purple-700/50 rounded-lg cursor-pointer hover:bg-purple-900/20 transition"
              >
                <Upload className="w-5 h-5 mr-2 text-amber-400" />
                <span className="text-gray-300">
                  {imageFile ? imageFile.name : "Click to select image"}
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
