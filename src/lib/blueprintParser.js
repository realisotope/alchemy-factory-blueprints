const PARSER_API_URL = "https://alchemy-save-parser.faulty.ws/queueBlueprint";
const SITE_ID = "alchemy-factory-blueprints.vercel.app";

const getParserSecret = () => {
  const secret = import.meta.env.VITE_PARSER_SECRET_KEY;
  if (!secret) {
    console.error("VITE_PARSER_SECRET_KEY environment variable is not set");
    throw new Error("Parser configuration error");
  }
  return secret;
};

export async function sendBlueprintToParser(file, blueprintId = null, retries = 3) {
  try {
    console.log(`[Parser API] Sending file: ${file.name}, Size: ${file.size}, Type: ${file.type}, BlueprintID: ${blueprintId}`);
    
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        // Read file as binary buffer
        const fileBuffer = await file.arrayBuffer();
        
        const formData = new FormData();
        // Create a Blob with proper binary type
        formData.append("file", new Blob([fileBuffer], { type: 'application/octet-stream' }), file.name);
        formData.append("siteId", SITE_ID);
        
        if (blueprintId) {
          formData.append("customId", blueprintId);
        }
        
        // Build webhook URL as query parameter
        const baseUrl = import.meta.env.VITE_NGROK_URL || window.location.origin;
        let webhookUrl = `${baseUrl}/api/blueprint-parsed`;
        
        // For development on localhost, warn that webhooks won't work
        if (!import.meta.env.VITE_NGROK_URL && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
          console.warn('[Parser API] ⚠️ Running on localhost without ngrok - parser webhooks will fail.');
          console.warn('[Parser API] To enable parsing, set up ngrok:');
          console.warn('[Parser API]   1. Install: ngrok http 5173');
          console.warn('[Parser API]   2. Add to .env.local: VITE_NGROK_URL=https://your-ngrok-url.ngrok.io');
          console.warn('[Parser API]   3. Restart dev server');
        }
        
        const parserUrl = new URL(PARSER_API_URL);
        parserUrl.searchParams.append("webhookUrl", webhookUrl);
        console.log(`[Parser API] Webhook URL: ${webhookUrl}`);
        console.log(`[Parser API] Parser URL: ${parserUrl.toString()}`);

        console.log(`[Parser API] Attempt ${attempt}/${retries}: Sending POST request...`);
        const response = await fetch(parserUrl.toString(), {
          method: "POST",
          headers: {
            "x-alchemy-secret": getParserSecret(),
          },
          body: formData,
        });

        console.log(`[Parser API] Attempt ${attempt}: Response status: ${response.status}`);
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error(`[Parser API] Attempt ${attempt}: Error response: ${errorText}`);
          
          // Retry on 5xx errors or timeout
          if (response.status >= 500 || response.status === 408) {
            if (attempt < retries) {
              console.log(`[Parser API] Retrying in 1 second...`);
              await new Promise(resolve => setTimeout(resolve, 1000));
              continue;
            }
          }
          throw new Error(`Parser API error: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        console.log(`[Parser API] Attempt ${attempt}: Success response:`, data);
        console.log(`[Parser API] Response structure: duplicate=${data.duplicate}, queued=${data.queued}, parsed=${data.parsed ? 'YES' : 'NO'}, fileHash=${data.fileHash}`);
        return data;
      } catch (error) {
        if (attempt < retries && (error.message.includes("Failed to fetch") || error.message.includes("NetworkError"))) {
          console.log(`[Parser API] Network error on attempt ${attempt}, retrying...`);
          await new Promise(resolve => setTimeout(resolve, 1000));
          continue;
        }
        throw error;
      }
    }
  } catch (error) {
    console.error("Error sending blueprint to parser:", error);
    throw error;
  }
}

export async function calculateFileHash(file) {
  try {
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
  } catch (error) {
    console.error("Error calculating file hash:", error);
    return null;
  }
}
