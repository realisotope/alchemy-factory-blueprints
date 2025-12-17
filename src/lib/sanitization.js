/**
 * Sanitize user input to prevent XSS attacks
 * @param {string} input - The input string to sanitize
 * @returns {string} - Sanitized string with HTML entities escaped
 */
export function sanitizeInput(input) {
  if (!input) return input;
  
  const div = document.createElement('div');
  div.textContent = input;
  return div.innerHTML;
}

/**
 * Validate UUID format
 * @param {string} uuid
 * @returns {boolean} - True if valid UUID format
 */
export function isValidUUID(uuid) {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

/**
 * Validate and sanitize title input
 * @param {string} title
 * @param {number} maxLength
 * @returns {object} - { valid: boolean, error?: string, sanitized?: string }
 */
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
  
  // Looking for script tags, event handlers, and dangerous protocols
  if (/<\s*script|javascript:|on\w+\s*=|<\s*iframe|<\s*object|<\s*embed|<\s*form|<\s*img\s+src|data:text\/html/i.test(trimmed)) {
    return { valid: false, error: 'Title contains forbidden content' };
  }
  
  return { valid: true, sanitized: sanitizeInput(trimmed) };
}

/**
 * Validate and sanitize description input
 * @param {string} description
 * @param {number} maxLength
 * @returns {object} - { valid: boolean, error?: string, sanitized?: string }
 */
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
  
  // Looking for script tags, event handlers, and dangerous protocols
  if (/<\s*script|javascript:|on\w+\s*=|<\s*iframe|<\s*object|<\s*embed|<\s*form|<\s*img\s+src|data:text\/html/i.test(trimmed)) {
    return { valid: false, error: 'Description contains forbidden content' };
  }
  
  return { valid: true, sanitized: sanitizeInput(trimmed) };
}

/**
 * Sanitize creator name to prevent injection attacks
 * @param {string} creatorName
 * @returns {string} - Sanitized creator name
 */
export function sanitizeCreatorName(creatorName) {
  if (!creatorName || typeof creatorName !== 'string') return '';
  return sanitizeInput(creatorName.trim());
}

/**
 * Validate and sanitize changelog input
 * @param {string} changelog
 * @param {number} maxLength
 * @returns {object} - { valid: boolean, error?: string, sanitized?: string }
 */
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
  
  // Looking for script tags, event handlers, and dangerous protocols
  if (/<\s*script|javascript:|on\w+\s*=|<\s*iframe|<\s*object|<\s*embed|<\s*form|<\s*img\s+src|data:text\/html/i.test(trimmed)) {
    return { valid: false, error: 'Changelog contains forbidden content' };
  }
  
  return { valid: true, sanitized: sanitizeInput(trimmed) };
}

/**
 * Sanitize title for use as a filename
 * @param {string} title
 * @returns {string} - Safe filename string
 */
export function sanitizeTitleForFilename(title) {
  if (!title || typeof title !== 'string') return 'blueprint';
  
  const sanitized = title.replace(/[^a-zA-Z0-9]/g, '');
  
  return sanitized || 'blueprint';
}