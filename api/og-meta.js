import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join } from 'path';

// Initialize Supabase client with public anon key
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

let indexHtmlTemplate = null;

function getIndexHtml() {
  if (!indexHtmlTemplate) {
    try {
      indexHtmlTemplate = readFileSync(join(process.cwd(), 'index.html'), 'utf-8');
    } catch (err) {
      console.error('Error reading index.html:', err);
      indexHtmlTemplate = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Alchemy Factory Blueprints</title>
    <script type="module" src="/src/main.jsx"></script>
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>`;
    }
  }
  return indexHtmlTemplate;
}

function escapeHtml(text) {
  if (!text) return '';
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, char => map[char]);
}

// Helper to check if string is a UUID
function isUUID(str) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

export default async function handler(req, res) {
  try {
    const { blueprintId } = req.query;
    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'https://alchemy-factory-blueprints.vercel.app';

    let ogTitle = 'Alchemy Factory Blueprint Hub';
    let ogDescription = 'Share and download optimized .png factory designs. The community hub for Alchemy Factory players.';
    let ogImage = `${baseUrl}/logo.jpg`;
    let ogUrl = baseUrl;
    let ogType = 'website';
    let pageTitle = 'Alchemy Factory Blueprints | Share & Download .png Layouts';

    // Only fetch blueprint data if a valid ID or slug is provided
    if (blueprintId) {
      try {
        // Query by UUID or slug
        let query = supabase
          .from('blueprints')
          .select('id, title, description, image_url, slug');
        
        if (isUUID(blueprintId)) {
          query = query.eq('id', blueprintId);
        } else {
          query = query.eq('slug', blueprintId);
        }
        
        const { data: blueprint, error } = await query.single();

        if (blueprint && !error) {
          ogTitle = blueprint.title;
          ogDescription = blueprint.description || `Check out this Alchemy Factory blueprint: ${blueprint.title}`;
          ogImage = blueprint.image_url || `${baseUrl}/logo.jpg`;
          // Use slug if available (human-readable), fall back to UUID
          const blueprintUrl = blueprint.slug ? `${baseUrl}/blueprint/${blueprint.slug}` : `${baseUrl}/blueprint/${blueprint.id}`;
          ogUrl = blueprintUrl;
          ogType = 'article';
          pageTitle = `${blueprint.title} | Alchemy Factory Blueprints`;
        }
      } catch (error) {
        console.error('Error fetching blueprint:', error);
      }
    }

    let html = getIndexHtml();

    const metaTags = `
    <title>${escapeHtml(pageTitle)}</title>
    <meta name="title" content="${escapeHtml(pageTitle)}" />
    <meta name="description" content="${escapeHtml(ogDescription)}" />
    
    <meta property="og:type" content="${escapeHtml(ogType)}" />
    <meta property="og:url" content="${escapeHtml(ogUrl)}" />
    <meta property="og:title" content="${escapeHtml(ogTitle)}" />
    <meta property="og:description" content="${escapeHtml(ogDescription)}" />
    <meta property="og:image" content="${escapeHtml(ogImage)}" />
    <meta property="og:site_name" content="Alchemy Factory Blueprints" />
    
    <meta property="twitter:card" content="summary_large_image" />
    <meta property="twitter:url" content="${escapeHtml(ogUrl)}" />
    <meta property="twitter:title" content="${escapeHtml(ogTitle)}" />
    <meta property="twitter:description" content="${escapeHtml(ogDescription)}" />
    <meta property="twitter:image" content="${escapeHtml(ogImage)}" />`;

    html = html.replace(/<meta property="og:[^>]+>/gi, '');
    html = html.replace(/<meta property="twitter:[^>]+>/gi, '');
    html = html.replace(/<meta name="(title|description)"[^>]+>/gi, '');
    html = html.replace(/<title>[^<]*<\/title>/i, '');
    
    html = html.replace('</head>', `${metaTags}\n  </head>`);

    // Set aggressive cache headers - cache for 24 hours on CDN, 7 days stale-while-revalidate
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=604800');
    res.setHeader('CDN-Cache-Control', 'max-age=86400');

    return res.status(200).send(html);
  } catch (error) {
    console.error('Error in handler:', error);
    return res.status(500).send('Internal Server Error');
  }
}
