/**
 * File Upload Security Validation
 * checks for malicious files/PNG blueprints
 */

const PNG_SIGNATURE = new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);

// Verify file magic bytes (signature)
export async function verifyFileSignature(file) {
  if (!file || !(file instanceof File)) {
    throw new Error('Invalid file object');
  }

  const fileName = file.name.toLowerCase();
  
  if (!fileName.endsWith('.png')) {
    return {
      valid: false,
      message: 'Only PNG blueprints are supported'
    };
  }

  const expectedSignature = PNG_SIGNATURE;
  const bytesToRead = PNG_SIGNATURE.length;
  const chunk = await file.slice(0, bytesToRead).arrayBuffer();
  const bytes = new Uint8Array(chunk);

  for (let i = 0; i < expectedSignature.length; i++) {
    if (bytes[i] !== expectedSignature[i]) {
      return {
        valid: false,
        message: 'File signature does not match PNG format'
      };
    }
  }

  return {
    valid: true,
    message: 'Valid file signature'
  };
}

// Validate PNG file integrity and structure
export async function validatePNGFile(file) {
  if (!file || !(file instanceof File)) {
    return { valid: false, error: 'Invalid file object' };
  }

  const fileName = file.name.toLowerCase();
  if (!fileName.endsWith('.png')) {
    return { valid: false, error: 'File must have .png extension' };
  }

  const MAX_PNG_SIZE = 20 * 1024 * 1024;
  if (file.size > MAX_PNG_SIZE) {
    return {
      valid: false,
      error: `PNG file must be smaller than ${formatBytes(MAX_PNG_SIZE)}`
    };
  }

  const signatureCheck = await verifyFileSignature(file);
  if (!signatureCheck.valid) {
    return {
      valid: false,
      error: 'File does not have valid PNG signature.',
      warnings: ['File claims to be PNG but has invalid magic bytes']
    };
  }

  return {
    valid: true,
    metadata: {
      type: 'PNG Blueprint',
      verified: true
    },
    warnings: []
  };
}

// Parse PNG file structure and validate chunks
// Returns metadata and detects invalid/suspiciou s structures
function parsePNGStructure(bytes) {
  const warnings = [];

  for (let i = 0; i < PNG_SIGNATURE.length; i++) {
    if (bytes[i] !== PNG_SIGNATURE[i]) {
      return { valid: false, warnings: ['Invalid PNG signature'] };
    }
  }

  // Parse IHDR chunk
  let offset = 8;
  let chunkCount = 0;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  let hasIDAT = false;
  let hasIEND = false;

  try {
    const ihdrLength = readUInt32BE(bytes, offset);
    const ihdrType = readChunkType(bytes, offset + 4);

    if (ihdrType !== 'IHDR') {
      return {
        valid: false,
        warnings: ['IHDR chunk error']
      };
    }

    if (ihdrLength !== 13) {
      return {
        valid: false,
        warnings: ['IHDR chunk has invalid length']
      };
    }

    // Parse IHDR data
    width = readUInt32BE(bytes, offset + 8);
    height = readUInt32BE(bytes, offset + 12);
    bitDepth = bytes[offset + 16];
    colorType = bytes[offset + 17];

    if (width === 0 || height === 0 || width > 1000000 || height > 1000000) {
      warnings.push('PNG dimensions are unusual: ' + width + 'x' + height);
    }

    const validColorTypes = [0, 2, 3, 4, 6];
    if (!validColorTypes.includes(colorType)) {
      return {
        valid: false,
        warnings: ['Invalid PNG color type: ' + colorType]
      };
    }

    const validBitDepths = {
      0: [1, 2, 4, 8, 16],
      2: [8, 16],
      3: [1, 2, 4, 8],
      4: [8, 16],
      6: [8, 16]
    };

    if (!validBitDepths[colorType].includes(bitDepth)) {
      warnings.push('Unusual bit depth for color type');
    }

    // Parse remaining chunks
    offset += 8 + ihdrLength + 4; // Skip IHDR + CRC
    chunkCount = 1;

    const maxChunks = 1000;
    while (offset + 8 < bytes.length && chunkCount < maxChunks) {
      const length = readUInt32BE(bytes, offset);
      const type = readChunkType(bytes, offset + 4);

      if (length > 1000000000) {
        return {
          valid: false,
          warnings: ['Chunk with suspiciously large size detected: ' + length]
        };
      }

      if (type === 'IDAT') {
        hasIDAT = true;
      } else if (type === 'IEND') {
        hasIEND = true;
        break;
      }

      if (type.charCodeAt(0) < 97 && !isKnownCriticalChunk(type)) {
        warnings.push('Unknown critical chunk: ' + type);
      }

      offset += 12 + length; // length + type + data + CRC
      chunkCount++;
    }

    if (!hasIDAT) {
      return {
        valid: false,
        warnings: ['PNG file missing IDAT chunk']
      };
    }

    if (!hasIEND) {
      return {
        valid: false,
        warnings: ['PNG file missing IEND chunk']
      };
    }

    if (chunkCount >= maxChunks) {
      return {
        valid: false,
        warnings: ['PNG file has too many chunks']
      };
    }

    return {
      valid: true,
      width,
      height,
      bitDepth,
      colorType,
      chunkCount,
      hasIDAT,
      hasIEND,
      warnings: warnings.length > 0 ? warnings : undefined
    };
  } catch (error) {
    return {
      valid: false,
      warnings: ['Failed to parse PNG structure: ' + error.message]
    };
  }
}

function isKnownCriticalChunk(type) {
  const knownCritical = ['IHDR', 'PLTE', 'IDAT', 'IEND'];
  return knownCritical.includes(type);
}

function readUInt32BE(bytes, offset) {
  return (bytes[offset] << 24) |
         (bytes[offset + 1] << 16) |
         (bytes[offset + 2] << 8) |
         bytes[offset + 3];
}

function readChunkType(bytes, offset) {
  return String.fromCharCode(bytes[offset], bytes[offset + 1], bytes[offset + 2], bytes[offset + 3]);
}

// File upload validation
export async function validateBlueprintFile(file) {
  if (!file || !(file instanceof File)) {
    return { valid: false, error: 'Invalid file object' };
  }

  const fileName = file.name.toLowerCase();

  if (!fileName.endsWith('.png')) {
    const fileExt = fileName.substring(fileName.lastIndexOf('.'));
    return {
      valid: false,
      error: `Only .png files are supported. ${fileExt === '.af' ? 'AF files are no longer supported, resave your blueprint in the new format.' : 'Invalid file type: ' + fileExt}`
    };
  }

  return await validatePNGFile(file);
}

// Scan file for suspicious patterns in embedded data - PNG sig is verified separately
export async function scanFileForThreats(file, isPng = false) {
  try {
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    const text = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
    const threats = [];

    const dangerousPatterns = [
      { name: 'POWERSHELL', pattern: /powershell/i, desc: 'PowerShell command detected', severity: 'medium' },
      { name: 'CMD_SHELL', pattern: /cmd\.exe/i, desc: 'Windows cmd detected', severity: 'medium' },
    ];

    for (const sig of dangerousPatterns) {
      if (sig.pattern.test(text)) {
        threats.push({
          type: sig.name,
          description: sig.desc,
          severity: sig.severity
        });
      }
    }

    return {
      clean: threats.length === 0,
      threats,
      scanTime: new Date().toISOString()
    };
  } catch (error) {
    // fallbak
    return {
      clean: false,
      threats: [{
        type: 'SCAN_ERROR',
        description: 'Could not scan file: ' + error.message,
        severity: 'high'
      }],
      scanTime: new Date().toISOString()
    };
  }
}

// Find PNG chunk by type in file
function findPNGChunk(bytes, chunkType) {
  const chunkTypeBytes = new TextEncoder().encode(chunkType);
  
  for (let i = 8; i < bytes.length - 4; i++) {
    let match = true;
    for (let j = 0; j < 4; j++) {
      if (bytes[i + j] !== chunkTypeBytes[j]) {
        match = false;
        break;
      }
    }
    if (match) {
      return i;
    }
  }
  
  return -1;
}

export function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

// Main security validation for PNG blueprints
export async function secureValidateFileUpload(file) {
  const errors = [];
  const warnings = [];

  try {
    if (!file || !(file instanceof File)) {
      return {
        success: false,
        errors: ['Invalid file object'],
        warnings: [],
        message: 'Validation error',
        timestamp: new Date().toISOString()
      };
    }

    const fileExt = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));
    
    if (fileExt !== '.png') {
      return {
        success: false,
        errors: [`Only .png files are supported. ${fileExt === '.af' ? 'AF files are no longer supported.' : 'Invalid file type: ' + fileExt}`],
        warnings: [],
        message: 'File type not supported',
        timestamp: new Date().toISOString()
      };
    }

    // File size
    if (file.size > 20 * 1024 * 1024) {
      errors.push('File size exceeds 20MB limit');
    }
    if (file.size < 100) {
      errors.push('File is too small to be a valid blueprint');
    }

    if (errors.length > 0) {
      return {
        success: false,
        errors,
        warnings,
        message: 'File size validation failed',
        timestamp: new Date().toISOString()
      };
    }

    // PNG signature verification
    const signatureCheck = await verifyFileSignature(file);
    if (!signatureCheck.valid) {
      errors.push(signatureCheck.message);
      return {
        success: false,
        errors,
        warnings,
        message: 'File signature validation failed',
        timestamp: new Date().toISOString()
      };
    }

    const threatScan = await scanFileForThreats(file, true);
    if (!threatScan.clean) {
      threatScan.threats.forEach(threat => {
        errors.push(`Security threat detected: ${threat.description}`);
      });
    }

    return {
      success: errors.length === 0,
      data: {
        filename: file.name,
        size: file.size,
        type: 'PNG',
        threats: threatScan.threats || [],
        validated: true
      },
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined,
      message: errors.length > 0 ? 'Validation failed' : 'File passed all security checks',
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    return {
      success: false,
      errors: [`Unexpected validation error: ${error.message}`],
      warnings: [],
      message: 'Validation error',
      timestamp: new Date().toISOString()
    };
  }
}

export default {
  validateBlueprintFile,
  validatePNGFile,
  verifyFileSignature,
  scanFileForThreats,
  secureValidateFileUpload,
  formatBytes
};
