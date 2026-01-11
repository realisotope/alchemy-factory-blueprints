import { v2 as cloudinary } from 'cloudinary';

// Configure Cloudinary with API credentials
cloudinary.config({
  cloud_name: process.env.VITE_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Serverless function to delete an image from Cloudinary
 * This requires API secret which must be server-side only
 */
export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { imageUrl } = req.body;

    if (!imageUrl) {
      return res.status(400).json({ error: 'Image URL is required' });
    }

    // Extract public_id from Cloudinary URL
    // URL format: https://res.cloudinary.com/{cloud_name}/image/upload/v{version}/{folder}/{public_id}.{ext}
    const publicIdMatch = imageUrl.match(/\/upload\/(?:v\d+\/)?(.+)\.\w+$/);
    
    if (!publicIdMatch) {
      return res.status(400).json({ error: 'Invalid Cloudinary URL format' });
    }

    const publicId = publicIdMatch[1];

    console.log('Deleting Cloudinary image:', publicId);

    // Delete the image from Cloudinary
    const result = await cloudinary.uploader.destroy(publicId);

    if (result.result === 'ok' || result.result === 'not found') {
      return res.status(200).json({ 
        success: true, 
        message: 'Image deleted successfully',
        result: result.result 
      });
    } else {
      console.error('Cloudinary deletion failed:', result);
      return res.status(500).json({ 
        error: 'Failed to delete image',
        details: result 
      });
    }
  } catch (error) {
    console.error('Error deleting Cloudinary image:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
}
