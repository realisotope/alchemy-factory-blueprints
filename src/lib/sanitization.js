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
 * @param {string} uuid - The UUID to validate
 * @returns {boolean} - True if valid UUID format
 */
export function isValidUUID(uuid) {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

/**
 * Validate and sanitize title input
 * @param {string} title - The title to validate
 * @param {number} maxLength - Maximum length (default 100)
 * @returns {object} - { valid: boolean, error?: string, sanitized?: string }
 */
export function validateAndSanitizeTitle(title, maxLength = 100) {
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
  
  // Check for suspicious patterns
  if (/<script|javascript:|on\w+\s*=|<iframe|<object/i.test(trimmed)) {
    return { valid: false, error: 'Title contains invalid characters' };
  }
  
  return { valid: true, sanitized: sanitizeInput(trimmed) };
}

/**
 * Validate and sanitize description input
 * @param {string} description - The description to validate
 * @param {number} maxLength - Maximum length (default 1000)
 * @returns {object} - { valid: boolean, error?: string, sanitized?: string }
 */
export function validateAndSanitizeDescription(description, maxLength = 1000) {
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
  
  // Check for suspicious patterns
  if (/<script|javascript:|on\w+\s*=|<iframe|<object/i.test(trimmed)) {
    return { valid: false, error: 'Description contains invalid characters' };
  }
  
  return { valid: true, sanitized: sanitizeInput(trimmed) };
}

/**
 * Validate and sanitize tag input
 * @param {string} tag - The tag to validate
 * @param {number} maxLength - Maximum length (default 20)
 * @returns {object} - { valid: boolean, error?: string, sanitized?: string }
 */
export function validateAndSanitizeTag(tag, maxLength = 20) {
  if (!tag || typeof tag !== 'string') {
    return { valid: false, error: 'Tag is required' };
  }
  
  const trimmed = tag.trim();
  
  if (trimmed.length === 0) {
    return { valid: false, error: 'Tag cannot be empty' };
  }
  
  if (trimmed.length > maxLength) {
    return { valid: false, error: `Tag must be under ${maxLength} characters` };
  }
  
  // Only allow alphanumeric, hyphens, and underscores
  if (!/^[a-zA-Z0-9_-]+$/.test(trimmed)) {
    return { valid: false, error: 'Tags can only contain letters, numbers, hyphens, and underscores' };
  }
  
  return { valid: true, sanitized: sanitizeInput(trimmed.toLowerCase()) };
}

/**
 * Sanitize creator name to prevent injection attacks
 * @param {string} creatorName - The creator name to sanitize
 * @returns {string} - Sanitized creator name
 */
export function sanitizeCreatorName(creatorName) {
  if (!creatorName || typeof creatorName !== 'string') return '';
  return sanitizeInput(creatorName.trim());
}
