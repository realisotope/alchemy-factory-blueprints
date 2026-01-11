import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client with public anon key
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

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

export default async function handler(req, res) {
  try {
    const { blueprintId } = req.query;
    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'https://alchemy-factory-blueprints.vercel.app';

    let ogTitle = 'Alchemy Factory Blueprint Hub';
    let ogDescription = 'Share and download optimized .af factory designs. The community hub for Alchemy Factory players.';
    let ogImage = `${baseUrl}/logo.jpg`;
    let ogUrl = baseUrl;
    let ogType = 'website';
    let pageTitle = 'Alchemy Factory Blueprints | Share & Download .af Layouts';

    // Only fetch blueprint data if a valid ID is provided
    if (blueprintId) {
      try {
        const { data: blueprint, error } = await supabase
          .from('blueprints')
          .select('id, title, description, image_url, slug')
          .eq('id', blueprintId)
          .single();

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

    // HTML template with dynamic meta tags
    const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="theme-color" content="#0f172a" />
    
    <title>${escapeHtml(pageTitle)}</title>
    <meta name="title" content="${escapeHtml(pageTitle)}" />
    <meta name="description" content="${escapeHtml(ogDescription)}" />
    <meta name="keywords" content="Alchemy Factory, Alchemy Factory Blueprints, .af files, factory automation layouts, alchemy factory guide, game blueprints" />
    <meta name="author" content="Alchemy Factory Blueprints/realisotope" />
    <meta name="robots" content="index, follow" />
    <meta name="language" content="English" />

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
    <meta property="twitter:image" content="${escapeHtml(ogImage)}" />
    
    <link rel="icon" type="image/png" href="/favicon.png" />
    <link rel="shortcut icon" href="/favicon.png" />
    <link rel="apple-touch-icon" href="/favicon.png" />
    <link rel="canonical" href="${escapeHtml(ogUrl)}" />
    <link rel="manifest" href="/manifest.json" />
    
    <style>
      html, body, #root {
        margin: 0;
        padding: 0;
        height: 100%;
      }
    </style>
    <script type="module" crossorigin src="/assets/main.js"></script>
    <link rel="stylesheet" crossorigin href="/assets/main.css">
  </head>
  <body>
    <h1 style="display:none;">Alchemy Factory Blueprints, .af Blueprint Sharing</h1>
    <div id="root"></div>
  </body>
</html>`;

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
