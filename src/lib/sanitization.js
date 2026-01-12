/**
 * Escape HTML entities to prevent XSS attacks
 * Pure text escaping approach - no HTML allowed, all special chars are escaped
 * Works both client-side and server-side (no DOM dependencies)
 * 
 * @param {string} input - The input string to escape
 * @returns {string} - HTML-safe string with all special characters escaped
 */
export function escapeHtml(input) {
  if (!input || typeof input !== 'string') return input;
  
  return input
    .replace(/&/g, '&amp;') // fir
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

// Validate UUID format
export function isValidUUID(uuid) {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

// Validate and sanitize title input
// Returns RAW text for database storage - escape only when displaying to user
export function validateAndSanitizeTitle(title, maxLength = 60) {
  if (!title || typeof title !== 'string') {
    return { valid: false, error: 'Title is required' };
  }
  
  const trimmed = title.trim();
  
  if (trimmed.length === 0) {
    return { valid: false, error: 'Title cannot be empty' };
  }
  
  if (trimmed.length > maxLength) {
    return { valid: false, error: `Title must be under ${maxLength} characters` };
  }
  
  // Return raw text for database storage
  // The text will be escaped with escapeHtml() only when displaying
  return { valid: true, sanitized: trimmed };
}

// Validate and sanitize description input
export function validateAndSanitizeDescription(description, maxLength = 1400) {
  if (!description) {
    return { valid: true, sanitized: '' };
  }
  
  if (typeof description !== 'string') {
    return { valid: false, error: 'Description must be text' };
  }
  
  const trimmed = description.trim();
  
  if (trimmed.length > maxLength) {
    return { valid: false, error: `Description must be under ${maxLength} characters` };
  }
  
  return { valid: true, sanitized: trimmed };
}

// Sanitize creator name
export function sanitizeCreatorName(creatorName) {
  if (!creatorName || typeof creatorName !== 'string') return '';
  
  return creatorName.trim();
}

// Validate and sanitize changelog input [! NO LONGER NEEDED !]
export function validateAndSanitizeChangelog(changelog, maxLength = 200) {
  if (!changelog) {
    return { valid: true, sanitized: null };
  }
  
  if (typeof changelog !== 'string') {
    return { valid: false, error: 'Changelog must be text' };
  }
  
  const trimmed = changelog.trim();
  
  if (trimmed.length === 0) {
    return { valid: true, sanitized: null };
  }
  
  if (trimmed.length > maxLength) {
    return { valid: false, error: `Changelog must be under ${maxLength} characters` };
  }

  return { valid: true, sanitized: trimmed };
}

/**
 * Sanitize title for use as a filename
 * Allows letters, numbers, hyphens, and underscores for readability
 * Converts spaces to dashes
 * @param {string} title
 * @returns {string} - Safe, readable filename string
 */
export function sanitizeTitleForFilename(title) {
  if (!title || typeof title !== 'string') return 'blueprint';
  
  const sanitized = title
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9\-_]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
  
  return sanitized || 'blueprint';
}