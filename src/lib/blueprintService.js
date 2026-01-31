import { supabase } from "./supabase";
import { uploadToCloudinary } from "./cloudinary";
import { deleteCloudinaryImage } from "./cloudinaryDelete";
import { put } from "@vercel/blob";
import { sendBlueprintToParser } from "./blueprintParser";
import { handleError, handleSuccess, logError } from "./errorHandler";


/**
 * BLUEPRINT QUERIES
 * Fetch all blueprints ordered by creation date
 */
export async function fetchAllBlueprints() {
  try {
    const { data, error } = await supabase
      .from("blueprints")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;
    return handleSuccess(data);
  } catch (error) {
    return handleError(error, 'FETCH_BLUEPRINTS');
  }
}

/**
 * BLUEPRINT QUERIES
 * Fetch a single blueprint by ID
 */
export async function fetchBlueprintById(blueprintId) {
  try {
    const { data, error } = await supabase
      .from("blueprints")
      .select("*")
      .eq("id", blueprintId)
      .single();

    if (error) throw error;
    return handleSuccess(data);
  } catch (error) {
    return handleError(error, 'FETCH_BLUEPRINT_BY_ID', { blueprintId });
  }
}

/**
 * BLUEPRINT QUERIES
 * Fetch blueprint by slug or ID (fo r sharing)
 */
export async function fetchBlueprintByIdentifier(identifier) {
  try {
    let query = supabase.from("blueprints").select("*");

    // Check if it's a UUID orslug
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier);

    if (isUuid) {
      query = query.eq("id", identifier);
    } else {
      query = query.eq("slug", identifier);
    }

    const { data, error } = await query.single();

    if (error) throw error;
    return handleSuccess(data);
  } catch (error) {
    return handleError(error, 'FETCH_BLUEPRINT_BY_IDENTIFIER', { identifier });
  }
}

/**
 * BLUEPRINT RATINGS
 * Fetch users ratings for blueprints (returns map of blueprintId -> rating)
 */
export async function fetchUserRatings(userId) {
  try {
    const { data, error } = await supabase
      .from("blueprint_likes")
      .select("blueprint_id, rating")
      .eq("user_id", userId);

    if (error && error.message?.includes('column "rating" does not exist')) {
      console.warn('Rating column not found - database migration not run yet');
      return handleSuccess(new Map());
    }
    
    if (error) throw error;
    
    // Convert array to Map for O(1) lookup
    const ratingsMap = new Map();
    data?.forEach((item) => {
      ratingsMap.set(item.blueprint_id, item.rating || 5);
    });
    
    return handleSuccess(ratingsMap);
  } catch (error) {
    return handleError(error, 'FETCH_USER_RATINGS', { userId });
  }
}

/**
 * BLUEPRINT RATINGS (Legacy compatibility)
 * Fetch users liked blueprint IDs (for backwards compatibility)
 */
export async function fetchUserLikes(userId) {
  try {
    const { data, error } = await supabase
      .from("blueprint_likes")
      .select("blueprint_id")
      .eq("user_id", userId);

    if (error) throw error;
    return handleSuccess(data?.map((like) => like.blueprint_id) || []);
  } catch (error) {
    return handleError(error, 'FETCH_USER_LIKES', { userId });
  }
}

// ============================================================================
// BLUEPRINT ACTIONS
// ============================================================================

/**
 * Create a new blueprint record
 */
export async function createBlueprint(blueprintData) {
  try {
    const { data, error } = await supabase
      .from("blueprints")
      .insert([blueprintData])
      .select()
      .single();

    if (error) throw error;
    return handleSuccess(data, 'Blueprint created successfully');
  } catch (error) {
    return handleError(error, 'CREATE_BLUEPRINT', { name: blueprintData?.name });
  }
}

/**
 * Update an existing blueprint
 */
export async function updateBlueprint(blueprintId, updates) {
  try {
    const { data, error } = await supabase
      .from("blueprints")
      .update(updates)
      .eq("id", blueprintId)
      .select()
      .single();

    if (error) throw error;
    return handleSuccess(data, 'Blueprint updated successfully');
  } catch (error) {
    return handleError(error, 'UPDATE_BLUEPRINT', { blueprintId });
  }
}

/**
 * Delete a blueprint
 */
export async function deleteBlueprint(blueprintId) {
  try {
    const { error } = await supabase
      .from("blueprints")
      .delete()
      .eq("id", blueprintId);

    if (error) throw error;
    return handleSuccess(null, 'Blueprint deleted successfully');
  } catch (error) {
    return handleError(error, 'DELETE_BLUEPRINT', { blueprintId });
  }
}

/**
 * BLUEPRINT RATINGS
 * Add or update a rating from a user to a blueprint (1-5 hearts)
 */
export async function rateBlueprint(blueprintId, userId, rating) {
  try {
    // Validate rating
    if (rating < 1 || rating > 5) {
      throw new Error('Rating must be between 1 and 5');
    }

    // Use upsert to insert or update
    const { error } = await supabase.from("blueprint_likes").upsert(
      {
        blueprint_id: blueprintId,
        user_id: userId,
        rating: rating
      },
      {
        onConflict: 'blueprint_id,user_id'
      }
    );

    // If rating column doesn't exist yet, fall back to simple insert (legacy)
    if (error && error.message?.includes('column "rating" does not exist')) {
      console.warn('Rating column not found - falling back to legacy like system');
      const { error: legacyError } = await supabase.from("blueprint_likes").upsert(
        {
          blueprint_id: blueprintId,
          user_id: userId
        },
        {
          onConflict: 'blueprint_id,user_id'
        }
      );
      if (legacyError) throw legacyError;
      return handleSuccess(null, 'Blueprint liked');
    }

    if (error) throw error;
    return handleSuccess(null, `Rated ${rating} hearts`);
  } catch (error) {
    return handleError(error, 'RATE_BLUEPRINT', { blueprintId, userId, rating });
  }
}

/**
 * BLUEPRINT RATINGS (Legacy compatibility)
 * Add a like from a user to a blueprint (defaults to 5 hearts)
 */
export async function likeBlueprint(blueprintId, userId) {
  return rateBlueprint(blueprintId, userId, 5);
}

/**
 * BLUEPRINT RATINGS
 * Remove a rating from a user to a blueprint
 */
export async function unlikeBlueprint(blueprintId, userId) {
  try {
    const { error } = await supabase
      .from("blueprint_likes")
      .delete()
      .eq("blueprint_id", blueprintId)
      .eq("user_id", userId);

    if (error) throw error;
    return handleSuccess(null, 'Rating removed');
  } catch (error) {
    return handleError(error, 'UNLIKE_BLUEPRINT', { blueprintId, userId });
  }
}

// ============================================================================
// FILE UPLOADS & STORAGE
// ============================================================================

/**
 * Upload blueprint file to Supabase storage
 */
export async function uploadBlueprintFile(bucket, filePath, file) {
  try {
    const { error } = await supabase.storage.from(bucket).upload(filePath, file, {
      upsert: true
    });

    if (error) throw error;

    // Get public URL
    const { data } = supabase.storage.from(bucket).getPublicUrl(filePath);
    return handleSuccess({ url: data.publicUrl }, 'Blueprint file uploaded successfully');
  } catch (error) {
    return handleError(error, 'UPLOAD_BLUEPRINT_FILE', { bucket, filePath });
  }
}

/**
 * Delete blueprint file from Supabase storage
 */
export async function deleteBlueprintFile(bucket, filePath) {
  try {
    const { error } = await supabase.storage.from(bucket).remove([filePath]);

    if (error) throw error;
    return handleSuccess(null, 'Blueprint file deleted successfully');
  } catch (error) {
    return handleError(error, 'DELETE_BLUEPRINT_FILE', { bucket, filePath });
  }
}

/**
 * Upload image file to Cloudinary
 */
export async function uploadImageToCloudinary(imageFile, userId) {
  try {
    const url = await uploadToCloudinary(imageFile, userId);
    return handleSuccess({ url }, 'Image uploaded successfully');
  } catch (error) {
    return handleError(error, 'UPLOAD_IMAGE_CLOUDINARY', { userId });
  }
}

/**
 * Delete image from Cloudinary
 */
export async function deleteImageFromCloudinary(publicId) {
  try {
    const result = await deleteCloudinaryImage(publicId);
    return handleSuccess(result, 'Image deleted successfully');
  } catch (error) {
    return handleError(error, 'DELETE_IMAGE_CLOUDINARY', { publicId });
  }
}

/**
 * Upload blob file to Vercel Blob storage - old/backup method
 */
export async function uploadBlobFile(file, filename) {
  try {
    const blob = await put(filename, file, { access: "public" });
    return handleSuccess({ url: blob.url }, 'File uploaded successfully');
  } catch (error) {
    return handleError(error, 'UPLOAD_BLOB_FILE', { filename });
  }
}

/**
 * BLUEPRINT PARSER API (faulty)
 * Send blueprint file to parser API and wait for completion
 */
export async function parseBlueprintFile(file, blueprintId, retries = 3, waitForParsing = false) {
  try {
    const result = await sendBlueprintToParser(file, blueprintId, retries, waitForParsing);
    return handleSuccess(result, 'Blueprint parsed successfully');
  } catch (error) {
    return handleError(error, 'PARSE_BLUEPRINT_FILE', { blueprintId });
  }
}

/**
 * MULTI PART BLUEPRINT HANDLING
 * Create or update multi-part blueprint entry
 */
export async function updateMultiPartBlueprint(blueprintId, parts) {
  try {
    const { data, error } = await supabase
      .from("blueprints")
      .update({
        is_multi_part: true,
        parts: parts
      })
      .eq("id", blueprintId)
      .select()
      .single();

    if (error) throw error;
    return handleSuccess(data, 'Multi-part blueprint updated successfully');
  } catch (error) {
    return handleError(error, 'UPDATE_MULTIPART_BLUEPRINT', { blueprintId });
  }
}

/**
 * MULTIPART BLUEPRINT HANDLING
 * Fetch multi-part blueprint parts
 */
export async function fetchMultiPartBlueprints(blueprintId) {
  try {
    const { data, error } = await supabase
      .from("blueprints")
      .select("*")
      .eq("id", blueprintId)
      .eq("is_multi_part", true)
      .single();

    if (error) throw error;
    return handleSuccess(data);
  } catch (error) {
    return handleError(error, 'FETCH_MULTIPART_BLUEPRINT', { blueprintId });
  }
}

/**
 * UTILITIES
 * Update blueprint view count / download count
 */
export async function incrementBlueprintDownloads(blueprintId) {
  try {
    const { data, error } = await supabase.rpc("increment_downloads", {
      blueprint_id: blueprintId
    });

    if (error) throw error;
    return handleSuccess(null);
  } catch (error) {
    return handleError(error, 'INCREMENT_DOWNLOADS', { blueprintId });
  }
}

/**
 * UTILITIES
 * Batch update blueprint likes from database trigger
 */
export async function getBlueprintLikeCount(blueprintId) {
  try {
    const { data, error } = await supabase
      .from("blueprints")
      .select("likes")
      .eq("id", blueprintId)
      .single();

    if (error) throw error;
    return handleSuccess({ count: data?.likes || 0 });
  } catch (error) {
    return handleError(error, 'GET_BLUEPRINT_LIKES', { blueprintId });
  }
}
