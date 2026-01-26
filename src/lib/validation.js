/**
 * Validation Library
 * Centralized validation rules for blueprints, images, files, and userr inputs
 */
import { isValidUUID } from './sanitization';
import { ALLOWED_URL_DOMAINS, isAllowedUrl } from './urlProcessor';


// BLUEPRINT VALIDATION

export function validateBlueprintTitle(title, maxLength = 60) {
  if (!title || typeof title !== 'string') {
    return { valid: false, error: 'Blueprint title is required' };
  }

  const trimmed = title.trim();

  if (trimmed.length === 0) {
    return { valid: false, error: 'Blueprint title cannot be empty' };
  }

  if (trimmed.length > maxLength) {
    return {
      valid: false,
      error: `Blueprint title must be ${maxLength} characters or fewer (currently ${trimmed.length})`
    };
  }

  if (trimmed.length < 3) {
    console.warn('Warning: Blueprint title is very short');
  }

  return { valid: true, sanitized: trimmed };
}

export function validateBlueprintDescription(description, maxLength = 2000) {
  if (!description || description.trim().length === 0) {
    return { valid: true, sanitized: '' };
  }

  if (typeof description !== 'string') {
    return { valid: false, error: 'Blueprint description must be text' };
  }

  const trimmed = description.trim();

  if (trimmed.length > maxLength) {
    return {
      valid: false,
      error: `Blueprint description must be ${maxLength} characters or fewer (currently ${trimmed.length})`
    };
  }

  return { valid: true, sanitized: trimmed };
}

export function validateCreatorName(creatorName) {
  if (!creatorName || typeof creatorName !== 'string') {
    return { valid: false, error: 'Creator name is required' };
  }

  const trimmed = creatorName.trim();

  if (trimmed.length === 0) {
    return { valid: false, error: 'Creator name cannot be empty' };
  }

  if (trimmed.length > 100) {
    return { valid: false, error: 'Creator name must be 100 characters or fewer' };
  }

  return { valid: true, sanitized: trimmed };
}

// ============================================================================
// FILE VALIDATION
// ============================================================================

// Validate .png blueprint file - basic checks only until upload processing
export function validateBlueprintFileBasic(file) {
  if (!file || !(file instanceof File)) {
    return { valid: false, error: 'File is required' };
  }

  const fileName = file.name.toLowerCase();

  if (!fileName.endsWith('.png')) {
    return {
      valid: false,
      error: 'Only PNG files are supported. AF files are no longer supported.'
    };
  }

  const MAX_PNG_SIZE = 20 * 1024 * 1024;

  if (file.size > MAX_PNG_SIZE) {
    return {
      valid: false,
      error: `Blueprint file must be smaller than ${formatBytes(MAX_PNG_SIZE)}`
    };
  }

  return { valid: true };
}

export function validateImageFile(file) {
  if (!file || !(file instanceof File)) {
    return { valid: false, error: 'Image file is required' };
  }

  const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
  const MAX_SIZE = 3 * 1024 * 1024;
  const MAX_WIDTH = 3840;
  const MAX_HEIGHT = 2160;

  if (!ALLOWED_TYPES.includes(file.type)) {
    return {
      valid: false,
      error: 'Image must be JPEG, PNG, or WebP format'
    };
  }

  if (file.size > MAX_SIZE) {
    return {
      valid: false,
      error: `Image must be smaller than ${formatBytes(MAX_SIZE)}`
    };
  }

  return { valid: true };
}

// Validate image dimensions
export async function validateImageDimensions(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      const img = new Image();

      img.onload = () => {
        const MAX_WIDTH = 3840;
        const MAX_HEIGHT = 2160;

        if (img.width > MAX_WIDTH || img.height > MAX_HEIGHT) {
          resolve({
            valid: false,
            error: `Image dimensions (${img.width}x${img.height}) exceed maximum (${MAX_WIDTH}x${MAX_HEIGHT})`
          });
        } else {
          resolve({
            valid: true,
            data: { width: img.width, height: img.height }
          });
        }
      };

      img.onerror = () => {
        resolve({
          valid: false,
          error: 'Failed to load image for validation'
        });
      };

      img.src = e.target.result;
    };

    reader.onerror = () => {
      resolve({
        valid: false,
        error: 'Failed to read image file'
      });
    };

    reader.readAsDataURL(file);
  });
}

// ============================================================================
// TAG VALIDATION
// ============================================================================

export function validateBlueprintTags(tags, availableTags = [], maxTags = 5) {
  if (!tags || tags.length === 0) {
    return { valid: true, sanitized: [] };
  }

  if (!Array.isArray(tags)) {
    return { valid: false, error: 'Tags must be an array' };
  }

  if (tags.length > maxTags) {
    return {
      valid: false,
      error: `Maximum ${maxTags} tags allowed (you selected ${tags.length})`
    };
  }

  if (availableTags.length > 0) {
    const invalidTags = tags.filter(tag => !availableTags.includes(tag));

    if (invalidTags.length > 0) {
      return {
        valid: false,
        error: `Invalid tags: ${invalidTags.join(', ')}`
      };
    }
  }

  return { valid: true, sanitized: tags };
}

// ============================================================================
// URL VALIDATION
// ============================================================================

export function validateDescriptionURLs(text) {
  if (!text || typeof text !== 'string') {
    return { valid: true };
  }

  const urlRegex = /(https?:\/\/[^\s<>"{}|\\^`\[\]]*)/g;
  const urls = text.match(urlRegex) || [];

  if (urls.length === 0) {
    return { valid: true };
  }

  if (ALLOWED_URL_DOMAINS.length === 0) {
    return { valid: true };
  }

  const invalidUrls = [];

  for (const url of urls) {
    try {
      const hostname = new URL(url).hostname;
      const isAllowed = ALLOWED_URL_DOMAINS.some(domain =>
        hostname === domain || hostname.endsWith('.' + domain)
      );

      if (!isAllowed) {
        invalidUrls.push(hostname);
      }
    } catch (e) {
      invalidUrls.push(url);
    }
  }

  if (invalidUrls.length > 0) {
    return {
      valid: false,
      error: `URLs from these domains are not allowed: ${[...new Set(invalidUrls)].join(', ')}`,
      invalidUrls
    };
  }

  return { valid: true };
}

// ============================================================================
// ID VALIDATION
// ============================================================================

export function validateUUID(uuid) {
  if (!uuid || typeof uuid !== 'string') {
    return { valid: false, error: 'ID is required' };
  }

  if (!isValidUUID(uuid)) {
    return { valid: false, error: 'Invalid ID format' };
  }

  return { valid: true };
}

export function validateBlueprintId(id) {
  if (!id || typeof id !== 'string') {
    return { valid: false, error: 'Blueprint ID is required' };
  }

  const trimmed = id.trim();

  if (trimmed.length === 0) {
    return { valid: false, error: 'Blueprint ID cannot be empty' };
  }

  // Accept both UUIDs and slugs
  if (trimmed.length > 100) {
    return { valid: false, error: 'Blueprint ID is invalid' };
  }

  return { valid: true, sanitized: trimmed };
}

// ============================================================================
// USER INPUT VALIDATION
// ============================================================================

export function validateTextField(value, rules = {}) {
  const {
    required = true,
    minLength = 1,
    maxLength = 255,
    fieldName = 'Field'
  } = rules;

  if (!value || typeof value !== 'string') {
    if (required) {
      return { valid: false, error: `${fieldName} is required` };
    }
    return { valid: true, sanitized: '' };
  }

  const trimmed = value.trim();

  if (required && trimmed.length === 0) {
    return { valid: false, error: `${fieldName} cannot be empty` };
  }

  if (trimmed.length < minLength) {
    return {
      valid: false,
      error: `${fieldName} must be at least ${minLength} characters`
    };
  }

  if (trimmed.length > maxLength) {
    return {
      valid: false,
      error: `${fieldName} must be ${maxLength} characters or fewer`
    };
  }

  return { valid: true, sanitized: trimmed };
}

export function validateEmail(email) {
  if (!email || typeof email !== 'string') {
    return { valid: false, error: 'Email is required' };
  }

  const trimmed = email.trim();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailRegex.test(trimmed)) {
    return { valid: false, error: 'Invalid email format' };
  }

  return { valid: true, sanitized: trimmed };
}

export function validateURL(url) {
  if (!url || typeof url !== 'string') {
    return { valid: false, error: 'URL is required' };
  }

  try {
    const urlObj = new URL(url);
    return { valid: true, sanitized: urlObj.toString() };
  } catch (e) {
    return { valid: false, error: 'Invalid URL format' };
  }
}

// ============================================================================
// BATCH VALIDATION
// ============================================================================

export function validateBatch(data, schema) {
  const errors = {};
  const sanitized = {};

  for (const [fieldName, validationFn] of Object.entries(schema)) {
    const result = validationFn(data[fieldName]);

    if (!result.valid) {
      errors[fieldName] = result.error;
    } else {
      sanitized[fieldName] = result.sanitized !== undefined ? result.sanitized : data[fieldName];
    }
  }

  const valid = Object.keys(errors).length === 0;

  return {
    valid,
    errors: valid ? {} : errors,
    data: sanitized
  };
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

export function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

export function sanitizeFilename(title) {
  if (!title || typeof title !== 'string') return 'blueprint';

  const sanitized = title
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9\-_]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');

  return sanitized || 'blueprint';
}

export function getDefaultBlueprintSchema() {
  return {
    title: (val) => validateBlueprintTitle(val),
    description: (val) => validateBlueprintDescription(val),
    creatorName: (val) => validateCreatorName(val)
  };
}

export function getImageValidationSchema() {
  return {
    imageFile: (val) => validateImageFile(val)
  };
}

export function getBlueprintFileSchema() {
  return {
    blueprintFile: (val) => validateBlueprintFileBasic(val)
  };
}
