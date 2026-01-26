/**
 * Blueprint Branding/Watermarking Utility
 * Embeds a <1kb 'Alchemy Factory Blueprint File' PNG image into blueprint PNG files as a custom PNG chunk
 */

function bufferToArray(buffer) {
  if (buffer instanceof Uint8Array) return buffer;
  if (buffer instanceof ArrayBuffer) return new Uint8Array(buffer);
  return new Uint8Array(buffer);
}

function arrayToBuffer(array) {
  return array;
}

// PNG chunk structure helpers
function createPngChunk(type, data) {
  const typeBytes = new TextEncoder().encode(type);
  const dataArray = bufferToArray(data);
  
  // Create length (4 bytes, big-endian)
  const length = new Uint8Array(4);
  const dataView = new DataView(length.buffer);
  dataView.setUint32(0, dataArray.length + typeBytes.length, false); // big-endian
  
  // Combine: length + type + data + CRC
  const crcData = new Uint8Array(typeBytes.length + dataArray.length);
  crcData.set(typeBytes, 0);
  crcData.set(dataArray, typeBytes.length);
  
  const crc = calculateCrc(crcData);
  const crcBuffer = new Uint8Array(4);
  const crcView = new DataView(crcBuffer.buffer);
  crcView.setUint32(0, crc, false); // big-endian
  
  const chunk = new Uint8Array(length.length + crcData.length + crcBuffer.length);
  chunk.set(length, 0);
  chunk.set(crcData, length.length);
  chunk.set(crcBuffer, length.length + crcData.length);
  
  return chunk;
}

function calculateCrc(buf) {
  const CRC_TABLE = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = ((c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1));
    }
    CRC_TABLE[n] = c;
  }
  
  let crc = 0xffffffff;
  const array = bufferToArray(buf);
  for (let i = 0; i < array.length; i++) {
    crc = CRC_TABLE[(crc ^ array[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function findIendChunkPosition(pngBuffer) {
  const array = bufferToArray(pngBuffer);
  const iendSignature = new Uint8Array([0x49, 0x45, 0x4e, 0x44]);
  
  let pos = array.length - 12; // IEND chunk is 12 bytes (4 len + 4 type + 4 CRC)
  
  // Scan backwards to find IEND
  while (pos > 0) {
    let found = true;
    for (let i = 0; i < 4; i++) {
      if (array[pos + i] !== iendSignature[i]) {
        found = false;
        break;
      }
    }
    if (found) {
      return pos;
    }
    pos -= 1;
  }
  
  return -1;
}

/**
 * Embed branding image into blueprint PNG
 * Fetches blueprintpng.png and embeds it as custom PNG chunk
 * 
 * @param {Blob|Uint8Array|ArrayBuffer} blueprintPngBuffer - The blueprint PNG file
 * @returns {Promise<Blob>} - Modified PNG blob with branding embedded
 */
export async function embedBrandingImage(blueprintPngBuffer) {
  try {
    // Convert input to Uint8Array
    let pngArray;
    if (blueprintPngBuffer instanceof Blob) {
      pngArray = new Uint8Array(await blueprintPngBuffer.arrayBuffer());
    } else if (blueprintPngBuffer instanceof ArrayBuffer) {
      pngArray = new Uint8Array(blueprintPngBuffer);
    } else {
      pngArray = bufferToArray(blueprintPngBuffer);
    }
    
    // Fetch branding image from public folder
    let brandingImage;
    try {
      const response = await fetch('/blueprintpng.png');
      if (!response.ok) {
        console.warn('Branding image not found (HTTP', response.status + ')');
        // Return original PNG as blob if branding image not available
        return new Blob([pngArray], { type: 'image/png' });
      }
      brandingImage = new Uint8Array(await response.arrayBuffer());
    } catch (fetchError) {
      console.warn('Failed to fetch branding image:', fetchError.message);
      // Return original PNG as blob if fetch fails
      return new Blob([pngArray], { type: 'image/png' });
    }
    
    // Create custom PNG chunk for branding
    // Using 'afBR' as chunk type (Alchemy Factory BRanding)
    // First letter lowercase = ancillary (optional), won't break PNG readers
    const brandingChunk = createPngChunk('afBR', brandingImage);
    
    // Find IEND chunk position
    const iendPos = findIendChunkPosition(pngArray);
    if (iendPos === -1) {
      console.warn('Invalid PNG file: IEND chunk not found');
      return new Blob([pngArray], { type: 'image/png' });
    }
    
    // Insert branding chunk before IEND
    const modifiedPng = new Uint8Array(iendPos + brandingChunk.length + (pngArray.length - iendPos));
    modifiedPng.set(pngArray.subarray(0, iendPos), 0);
    modifiedPng.set(brandingChunk, iendPos);
    modifiedPng.set(pngArray.subarray(iendPos), iendPos + brandingChunk.length);
    
    return new Blob([modifiedPng], { type: 'image/png' });
  } catch (error) {
    console.error('Error embedding branding image:', error);
    // Return original blueprint as blob if branding fails (don't break the file)
    if (blueprintPngBuffer instanceof Blob) {
      return blueprintPngBuffer;
    }
    const array = bufferToArray(blueprintPngBuffer);
    return new Blob([array], { type: 'image/png' });
  }
}

/**
 * Extract branding image from blueprint PNG
 * Retrieves the embedded branding image if present
 * 
 * @param {Blob|Uint8Array|ArrayBuffer} blueprintPngBuffer - The blueprint PNG file
 * @returns {Uint8Array|null} - Branding image array or null if not found
 */
export function extractBrandingImage(blueprintPngBuffer) {
  try {
    const array = bufferToArray(blueprintPngBuffer);
    const brandingChunkType = new TextEncoder().encode('afBR');
    let pos = 8; // Skip PNG signature
    
    while (pos < array.length - 12) {
      // Read chunk length (big-endian)
      const lengthView = new DataView(array.buffer, array.byteOffset + pos, 4);
      const length = lengthView.getUint32(0, false);
      
      // Read chunk type
      const chunkType = array.subarray(pos + 4, pos + 8);
      
      // Compare chunk type
      let isMatch = true;
      for (let i = 0; i < 4; i++) {
        if (chunkType[i] !== brandingChunkType[i]) {
          isMatch = false;
          break;
        }
      }
      
      if (isMatch) {
        // Found branding chunk - extract data
        return array.subarray(pos + 8, pos + 8 + length);
      }
      
      // Move to next chunk (length + type + data + CRC)
      pos += 12 + length;
    }
    
    return null; // Branding image not found
  } catch (error) {
    console.error('Error extracting branding image:', error);
    return null;
  }
}

/**
 * Check if blueprint has branding embedded
 * 
 * @param {Blob|Uint8Array|ArrayBuffer} blueprintPngBuffer - The blueprint PNG file
 * @returns {boolean} - True if branding is present
 */
export function hasBrandingImage(blueprintPngBuffer) {
  return extractBrandingImage(blueprintPngBuffer) !== null;
}

export default {
  embedBrandingImage,
  extractBrandingImage,
  hasBrandingImage
};
