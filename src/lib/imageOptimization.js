/**
 * Optimize Vercel Blob image URLs for responsive delivery
 * Vercel Blob supports query parameters to transform images on-the-fly
 * @see https://vercel.com/docs/storage/vercel-blob/using-blob-urls
 */

/**
 * Generate optimized image URL for Vercel Blob
 * @param {string} imageUrl - Original Vercel Blob image URL
 * @param {Object} options - Optimization options
 * @param {number} options.width - Image width in pixels
 * @param {number} options.quality - Image quality (0-100, default 75)
 * @returns {string} Optimized image URL
 */
export function getOptimizedImageUrl(imageUrl, options = {}) {
  if (!imageUrl) return null;
  
  // Only apply optimization to Vercel Blob URLs
  if (!imageUrl.includes('blob.vercel-storage.com')) {
    return imageUrl;
  }

  const url = new URL(imageUrl);
  
  // Apply width parameter (Vercel Blob automatically maintains aspect ratio)
  if (options.width) {
    url.searchParams.set('width', options.width);
  }
  
  // Apply quality parameter (lower quality = smaller file size)
  if (options.quality !== undefined) {
    url.searchParams.set('quality', Math.min(100, Math.max(1, options.quality)));
  }
  
  return url.toString();
}

/**
 * Get thumbnail URL optimized for gallery preview
 * @param {string} imageUrl - Original Vercel Blob image URL
 * @returns {string} Optimized URL for h-48 (192px) display
 */
export function getThumbnailUrl(imageUrl) {
  return getOptimizedImageUrl(imageUrl, {
    width: 400,        // 2x the 192px display height for retina screens
    quality: 50        // Lower quality for thumbnails, saves ~60% bandwidth
  });
}

/**
 * Get standard view URL optimized for normal blueprint detail view
 * @param {string} imageUrl - Original Vercel Blob image URL
 * @returns {string} Optimized URL for h-96 (384px) display
 */
export function getDetailViewUrl(imageUrl) {
  return getOptimizedImageUrl(imageUrl, {
    width: 800,        // Optimized for detailed view, 2x the display size
    quality: 60        // Balanced quality
  });
}

/**
 * Get full resolution URL for lightbox expansion
 * @param {string} imageUrl - Original Vercel Blob image URL
 * @returns {string} URL with minimal optimization (higher quality)
 */
export function getLightboxUrl(imageUrl) {
  return getOptimizedImageUrl(imageUrl, {
    width: 1200,       // Full detail but capped to prevent excessive size
    quality: 70        // Higher quality for expanded view
  });
}
