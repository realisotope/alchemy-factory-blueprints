/**
 * URL processing utilities for blueprint descriptions
 * Validates, filters, and converts URLs to clickable links
 */

const ALLOWED_URL_DOMAINS = [
  'youtube.com',
  'youtu.be',
  'discord.com',
  'alchemy-factory-codex.com',
  'joejoesgit.github.io',
  'alchemyfactorytools.com',
  'alchemy-factory-blueprints.vercel.app',
];

export function isAllowedUrl(url) {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();
    
    return ALLOWED_URL_DOMAINS.some(domain => 
      hostname === domain || hostname.endsWith('.' + domain)
    );
  } catch (e) {
    return false;
  }
}

export function extractUrls(text) {
  if (!text || typeof text !== 'string') return [];
  
  const urlRegex = /(https?:\/\/[^\s<>"{}|\\^`\[\]]*)/g;
  const matches = text.match(urlRegex) || [];
  
  return [...new Set(matches)];
}

// Validate URLs in description text
export function validateDescriptionUrls(text) {
  if (!text || typeof text !== 'string') {
    return { valid: true };
  }
  
  const urls = extractUrls(text);
  
  if (urls.length === 0) {
    return { valid: true };
  }
  
  const invalidUrls = urls.filter(url => !isAllowedUrl(url));
  
  if (invalidUrls.length > 0) {
    return {
      valid: false,
      error: `URLs from these domains are not allowed: ${invalidUrls.map(u => {
        try {
          return new URL(u).hostname;
        } catch (e) {
          return u;
        }
      }).join(', ')}. Allowed domains: YouTube, Discord, Alchemy Factory Codex, JoeJoesGit, AlchemyFactoryTools.`,
      invalidUrls
    };
  }
  
  return { valid: true };
}

// Convert URLs in text to clickable links (returns JSX elements)
export function parseUrlsInText(text) {
  if (!text || typeof text !== 'string') return [text];
  
  const urlRegex = /(https?:\/\/[^\s<>"{}|\\^`\[\]]*)/g;
  const parts = [];
  let lastIndex = 0;
  let match;
  
  const regex = new RegExp(urlRegex);
  
  while ((match = regex.exec(text)) !== null) {
    const url = match[0];
    
    if (match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index));
    }
    
    if (isAllowedUrl(url)) {
      parts.push({
        type: 'link',
        url: url,
        text: shortenUrl(url)
      });
    } else {
      parts.push(url);
    }
    
    lastIndex = regex.lastIndex;
  }
  
  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }
  
  return parts.length === 0 ? [text] : parts;
}

function shortenUrl(url) {
  if (url.length <= 60) return url;
  return url.substring(0, 57) + '...';
}

export function addAllowedDomains(domains) {
  const domainsArray = Array.isArray(domains) ? domains : [domains];
  domainsArray.forEach(domain => {
    if (!ALLOWED_URL_DOMAINS.includes(domain)) {
      ALLOWED_URL_DOMAINS.push(domain.toLowerCase());
    }
  });
}

export function getAllowedDomains() {
  return [...ALLOWED_URL_DOMAINS];
}
