/**
 * CORS and Authentication Security Configuration
 * Manages cross-origin requests and token security
 */

export const ALLOWED_ORIGINS = [
  'https://alchemy-factory-blueprints.vercel.app',
];

// Returns CORS headers for API responses
export function getCORSHeaders(origin) {
  const isAllowed = ALLOWED_ORIGINS.includes(origin);

  return {
    'Access-Control-Allow-Origin': isAllowed ? origin : '',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
    'Access-Control-Allow-Credentials': 'true'
  };
}

// Handles CORS preflight requests (OPTIONS)
export function handleCORSPreflight(req, res) {
  if (req.method === 'OPTIONS') {
    const headers = getCORSHeaders(req.headers.origin || '');
    Object.entries(headers).forEach(([key, value]) => {
      res.setHeader(key, value);
    });
    res.status(200).end();
    return true;
  }
  return false;
}

// Validates JWT token format
export function validateTokenFormat(token) {
  if (!token || typeof token !== 'string') return false;

  const parts = token.split('.');
  if (parts.length !== 3) return false;

  const base64urlRegex = /^[A-Za-z0-9_-]+$/;
  return parts.every(part => base64urlRegex.test(part));
}

// Extracts token from Authorization header
export function extractBearerToken(authHeader) {
  if (!authHeader || typeof authHeader !== 'string') return null;

  const [scheme, token] = authHeader.split(' ');

  if (scheme !== 'Bearer' || !token) return null;

  return validateTokenFormat(token) ? token : null;
}

export const RATE_LIMITS = {
  blueprint_list: {
    requests: 200,
    window: 3600
  },
  blueprint_detail: {
    requests: 200,
    window: 3600
  },
  blueprint_upload: {
    requests: 20,
    window: 3600
  },
  blueprint_update: {
    requests: 20,
    window: 3600
  },
  blueprint_delete: {
    requests: 20,
    window: 3600
  },
  like_blueprint: {
    requests: 40,
    window: 3600
  },
  file_upload: {
    requests: 20,
    window: 3600
  },
  image_upload: {
    requests: 40,
    window: 3600
  },
  search: {
    requests: 60,
    window: 3600
  }
};

export default {
  ALLOWED_ORIGINS,
  getCORSHeaders,
  handleCORSPreflight,
  validateTokenFormat,
  extractBearerToken,
  RATE_LIMITS
};
