import imageCompression from 'browser-image-compression';

/**
 * Shared utilities for blueprint PNG extraction and processing
 * Used by both BlueprintUpload and BlueprintEdit
 */

/**
 * Creates an independent File from the stripped blueprint data
 * Prevents reference sharing issues between blueprint and image blobs
 */
export async function createIndependentBlueprintFile(validation, originalFile) {
  if (!validation.isPng) {
    return originalFile;
  }

  // Read the blob as an array buffer to ensure a complete copy
  const strippedBuffer = await validation.strippedFile.arrayBuffer();
  const strippedBlob = new Blob([strippedBuffer], { type: 'image/png' });
  return new File([strippedBlob], originalFile.name, { type: 'image/png' });
}

/**
 * MUTLI PART BLUEPRINTS
 * Compresses a blueprints extracted PNG preview image
 */
export async function compressExtractedPngImage(imageBlob, partIndex, imageCompression) {
  const imageFile = new File([imageBlob], `part${partIndex + 1}-preview.png`, { type: 'image/png' });

  const options = {
    maxSizeMB: 0.3,
    maxWidthOrHeight: 1500,
    useWebWorker: true,
    initialQuality: 0.55
  };

  try {
    const compressedImage = await imageCompression(imageFile, options);
    return {
      success: true,
      file: compressedImage,
      originalSize: imageBlob.size,
      compressedSize: compressedImage.size
    };
  } catch (error) {
    console.error('Image compression failed for part:', partIndex, error);
    // Fall back to uncompressed, for now 1@!
    return {
      success: true,
      file: imageFile,
      originalSize: imageBlob.size,
      compressedSize: imageFile.size
    };
  }
}

/**
 * MUTLI PART BLUEPRINTS
 * Populates extracted PNG image as preview for a multi-part blueprint
 */
export async function populateExtractedImageForPart(
  validation,
  partIndex,
  imageFiles,
  setImageFiles,
  imagePreviews,
  setImagePreviews,
  imageCompressionInfo,
  setImageCompressionInfo,
  isEditMode = false
) {
  if (!validation.imageBlob || imageFiles[partIndex] || isEditMode) {
    return;
  }

  try {
    const result = await compressExtractedPngImage(validation.imageBlob, partIndex, imageCompression);

    const reader = new FileReader();
    reader.onload = (event) => {
      const newImageFiles = [...imageFiles];
      newImageFiles[partIndex] = result.file;
      setImageFiles(newImageFiles);

      const newImagePreviews = [...imagePreviews];
      newImagePreviews[partIndex] = event.target.result;
      setImagePreviews(newImagePreviews);

      const newImageCompressionInfo = [...imageCompressionInfo];
      newImageCompressionInfo[partIndex] = {
        originalSize: validation.imageBlob.size,
        compressedSize: result.compressedSize,
        fromPng: true
      };
      setImageCompressionInfo(newImageCompressionInfo);
    };
    reader.readAsDataURL(result.file);
  } catch (error) {
    console.error('Failed to populate extracted PNG image for part:', partIndex, error);
  }
}

/**
 * SINGLE PART BLUEPRINTS
 * Processes and populates extracted single-part PNG preview images.
 */
export async function processSinglePartExtractedImage(
  validation,
  imageFiles,
  setImageFiles,
  imagePreviews,
  setImagePreviews,
  imageCompressionInfo,
  setImageCompressionInfo,
  isEditMode = false
) {
  if (!validation.imageBlob || imageFiles[0] || isEditMode) {
    return;
  }

  try {
    const imageFile = new File([validation.imageBlob], 'preview.png', { type: 'image/png' });
    const options = {
      maxSizeMB: 0.3,
      maxWidthOrHeight: 1500,
      useWebWorker: true,
      initialQuality: 0.55
    };

    const compressedFile = await imageCompression(imageFile, options);

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
  } catch (error) {
    console.warn('Failed to compress PNG image:', error);
  }
}
