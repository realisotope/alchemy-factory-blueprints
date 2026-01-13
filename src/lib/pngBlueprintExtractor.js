// PNG Blueprint signatures
const PNG_SIGNATURE = new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
const IEND_CHUNK = new Uint8Array([0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82]);
const BLUEPRINT_PNG_SIGNATURE = new Uint8Array([0x0E, 0x00, 0x00, 0x00, 0x55, 0x70, 0x6C, 0x6F, 0x61, 0x64, 0x65, 0x64, 0x49, 0x6D, 0x61, 0x67, 0x65]);

const arrayEquals = (a, b) => {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
};

// Find the index of a byte pattern within a larger Uint8Array
const findBytePattern = (haystack, needle) => {
  for (let i = 0; i <= haystack.length - needle.length; i++) {
    let found = true;
    for (let j = 0; j < needle.length; j++) {
      if (haystack[i + j] !== needle[j]) {
        found = false;
        break;
      }
    }
    if (found) return i;
  }
  return -1;
};

// Validate that a file starts with PNG signature
const validatePngSignature = (buffer) => {
  if (buffer.length < PNG_SIGNATURE.length) {
    throw new Error("File too small to be a valid PNG");
  }
  
  const fileSignature = new Uint8Array(buffer.slice(0, PNG_SIGNATURE.length));
  if (!arrayEquals(fileSignature, PNG_SIGNATURE)) {
    throw new Error("Invalid PNG file signature");
  }
};

// Find the IEND chunk position in PNG data
const findIendChunk = (buffer) => {
  const bufferArray = new Uint8Array(buffer);
  const iendIndex = findBytePattern(bufferArray, IEND_CHUNK);
  
  if (iendIndex === -1) {
    throw new Error("Invalid PNG file structure - IEND chunk not found");
  }
  
  return iendIndex;
};

// Validate blueprint signature in extracted data
const validateBlueprintSignature = (blueprintData) => {
  if (blueprintData.length < BLUEPRINT_PNG_SIGNATURE.length) {
    throw new Error("PNG does not contain valid blueprint data");
  }
  
  const dataSignature = new Uint8Array(blueprintData.slice(0, BLUEPRINT_PNG_SIGNATURE.length));
  if (!arrayEquals(dataSignature, BLUEPRINT_PNG_SIGNATURE)) {
    throw new Error("PNG does not contain a valid blueprint signature");
  }
};

/**
 * Extract blueprint data from PNG file
 * Returns a new Blob containing only the IEND chunk + blueprint data (image data removed)
 * 
 * @param {File} pngFile
 * @returns {Promise<{strippedFile: Blob, originalSize: number, strippedSize: number}>}
 */
export const extractBlueprintFromPng = async (pngFile) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const buffer = e.target.result;
        const originalSize = buffer.byteLength;
        
        validatePngSignature(buffer);
        
        const iendIndex = findIendChunk(buffer);
        const blueprintDataStart = iendIndex;
        const blueprintData = buffer.slice(blueprintDataStart);
        const dataAfterIend = buffer.slice(iendIndex + IEND_CHUNK.length);
        
        validateBlueprintSignature(dataAfterIend);
        
        // create
        const strippedSize = PNG_SIGNATURE.length + IEND_CHUNK.length + dataAfterIend.byteLength;
        const strippedBuffer = new Uint8Array(strippedSize);

        let offset = 0;
        strippedBuffer.set(PNG_SIGNATURE, offset);
        offset += PNG_SIGNATURE.length;
        strippedBuffer.set(IEND_CHUNK, offset);
        offset += IEND_CHUNK.length;
        strippedBuffer.set(new Uint8Array(dataAfterIend), offset);
        
        const strippedBlob = new Blob([strippedBuffer], { type: 'image/png' });
        
        resolve({
          strippedFile: strippedBlob,
          originalSize,
          strippedSize: strippedBlob.size,
          compressionRatio: ((1 - strippedBlob.size / originalSize) * 100).toFixed(1)
        });
        
      } catch (error) {
        reject(error);
      }
    };
    
    reader.onerror = () => {
      reject(new Error("Failed to read PNG file"));
    };
    
    reader.readAsArrayBuffer(pngFile);
  });
};

export const isPngBlueprint = (filename) => {
  return filename.toLowerCase().endsWith('.png');
};

export const formatBytes = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
};
