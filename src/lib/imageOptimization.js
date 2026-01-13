/**
 * Optimize image URLs for responsive delivery
 * Supports both Cloudinary and Vercel Blob URLs
 * Applies transformations for thumbnails and detail views
 * 
 * @see https://cloudinary.com/documentation/image_transformations
 * @see https://vercel.com/docs/storage/vercel-blob/using-blob-urls
 */

/**
 * Generate optimized image URL for Cloudinary or Vercel Blob
 * @param {string} imageUrl - Original image URL
 * @param {Object} options - Optimization options
 * @param {number} options.width - Image width in pixels
 * @param {number} options.quality - Image quality (0-100, default 75)
 * @param {boolean} options.thumbnail - If true, aggressively optimize for thumbnails
 * @returns {string} Optimized image URL
 */
export function getOptimizedImageUrl(imageUrl, options = {}) {
  if (!imageUrl) return null;
  
  if (imageUrl.includes('cloudinary.com')) {
    return getCloudinaryOptimizedUrl(imageUrl, options);
  }
  
  if (imageUrl.includes('blob.vercel-storage.com')) {
    return getVercelBlobOptimizedUrl(imageUrl, options);
  }

  return imageUrl;
}

/**
 * Optimize Cloudinary URLs using URL-based transformations
 * Applies to both thumbnails and detail views
 */
function getCloudinaryOptimizedUrl(imageUrl, options = {}) {
  try {
    // Parse Cloudinary URL structure
    // Format: https://res.cloudinary.com/{cloud}/image/upload/v{version}/{path}
    const uploadIndex = imageUrl.indexOf('/upload/');
    if (uploadIndex === -1) return imageUrl;

    // Skip optimization only for lightbox view
    if (options.lightbox) {
      return imageUrl;
    }

    const baseUrl = imageUrl.substring(0, uploadIndex + 8);
    const imagePath = imageUrl.substring(uploadIndex + 8);

    const transformations = [];
    transformations.push('f_auto');
    
    // Apply width and quality transformations
    if (options.width) {
      transformations.push(`w_${options.width}`);
    }
    if (options.quality !== undefined) {
      const q = Math.min(100, Math.max(1, options.quality));
      transformations.push(`q_${q}`);
    }

    const transformString = transformations.join(',');
    return `${baseUrl}${transformString}/${imagePath}`;
  } catch (error) {
    console.error('Error optimizing Cloudinary URL:', error);
    return imageUrl;
  }
}

// Optimize Vercel Blob URLs using query parameters
function getVercelBlobOptimizedUrl(imageUrl, options = {}) {
  try {
    const url = new URL(imageUrl);
    
    if (options.width) {
      url.searchParams.set('width', options.width);
    }
    
    if (options.quality !== undefined) {
      url.searchParams.set('quality', Math.min(100, Math.max(1, options.quality)));
    }
    
    return url.toString();
  } catch (error) {
    console.error('Error optimizing Vercel Blob URL:', error);
    return imageUrl;
  }
}

/**
 * Get thumbnail URL optimized for gallery preview
 * Aggressive optimization for maximum bandwidth savings
 * @param {string} imageUrl - Original image URL
 * @returns {string} Optimized URL for h-48 (192px) display
 */
export function getThumbnailUrl(imageUrl) {
  return getOptimizedImageUrl(imageUrl, {
    width: 400,        // 2x the 192px display height for retina screens
    quality: 50,       // Compression for thumbnails
    thumbnail: true
  });
}

/**
 * Get optimized URL for blueprint detail view
 * Balances quality and bandwidth - detail view is frequently accessed
 * @param {string} imageUrl - Original image URL
 * @returns {string} Optimized URL for h-96 (384px) display
 */
export function getDetailViewUrl(imageUrl) {
  return getOptimizedImageUrl(imageUrl, {
    width: 800,        // 2x the 384px display height for retina screens
    quality: 65        // Compression for detail view
  });
}

// Get full resolution URL for lightbox expansion
export function getLightboxUrl(imageUrl) {
  return getOptimizedImageUrl(imageUrl, {
    lightbox: true
  });
}

// Prefetch image for faster loading when needed
export function prefetchImage(imageUrl) {
  if (!imageUrl || typeof window === 'undefined') return;
  
  // Use browser's native prefetch via link element
  const link = document.createElement('link');
  link.rel = 'prefetch';
  link.as = 'image';
  link.href = imageUrl;
  document.head.appendChild(link);
}
