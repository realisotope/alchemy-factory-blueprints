/**
 * Helper function to delete an image from Cloudinary via API
 * @param {string} imageUrl - The Cloudinary image URL to delete
 * @returns {Promise<boolean>} - True if deletion was successful
 */
export async function deleteCloudinaryImage(imageUrl) {
  if (!imageUrl) return false;
  
  if (!imageUrl.includes('cloudinary.com')) {
    console.log('Skipping deletion - not a Cloudinary URL:', imageUrl);
    return false;
  }

  try {
    const response = await fetch('/api/delete-cloudinary-image', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ imageUrl }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Failed to delete Cloudinary image:', data);
      return false;
    }

    console.log('Cloudinary image deleted:', imageUrl);
    return true;
  } catch (error) {
    console.error('Error calling delete API:', error);
    return false;
  }
}
