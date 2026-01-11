/**
 * Blueprint slug utilities
 * Generates user-friendly slugs from blueprint titles and timestamps
 */

export function generateSlug(title, date = new Date()) {
  if (!title || typeof title !== 'string') {
    throw new Error('Title is required to generate slug');
  }

  const slugTitle = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 50);

  const timestamp = Math.floor(date.getTime() / 1000);
  
  return `${slugTitle}-${timestamp}`;
}

export function isUUID(str) {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

export function extractTimestampFromSlug(slug) {
  if (!slug || typeof slug !== 'string') return null;
  
  const parts = slug.split('-');
  const lastPart = parts[parts.length - 1];
  const timestamp = parseInt(lastPart, 10);
  
  const oneYearAgo = Math.floor((Date.now() - 365 * 24 * 60 * 60 * 1000) / 1000);
  const oneYearFuture = Math.floor((Date.now() + 365 * 24 * 60 * 60 * 1000) / 1000);
  
  if (timestamp >= oneYearAgo && timestamp <= oneYearFuture && !isNaN(timestamp)) {
    return timestamp;
  }
  
  return null;
}
