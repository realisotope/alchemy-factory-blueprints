const PARSER_API_URL = "https://alchemy-save-parser.faulty.ws/queueBlueprint";
const SITE_ID = "alchemy-factory-blueprints.vercel.app";

const getParserSecret = () => {
  const secret = import.meta.env.PARSER_API_KEY;
  if (!secret) {
    console.error("Parser API key/environment variable is not set");
    throw new Error("Parser configuration error");
  }
  return secret;
};

export async function sendBlueprintToParser(file, blueprintId = null, retries = 3, waitForParsing = false) {
  try {
    console.log(`[Parser] Processing: ${file.name} (${(file.size / 1024).toFixed(2)} KB)`);
    
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
        
        const parserUrl = new URL(PARSER_API_URL);
        parserUrl.searchParams.append("webhookUrl", webhookUrl);
        console.log(`[Parser] Webhook URL: ${webhookUrl}`);

        const response = await fetch(parserUrl.toString(), {
          method: "POST",
          headers: {
            "x-alchemy-secret": getParserSecret(),
          },
          body: formData,
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`[Parser] Error (${response.status}): ${errorText}`);
          
          // Retry on 5xx errors or timeout
          if (response.status >= 500 || response.status === 408) {
            if (attempt < retries) {
              console.log(`[Parser] Retrying...`);
              await new Promise(resolve => setTimeout(resolve, 1000));
              continue;
            }
          }
          throw new Error(`Parser API error: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        console.log(`[Parser] Response: ${data.duplicate ? 'cached' : 'new'}, queued=${data.queued}, parsed=${data.parsed ? '✓' : '✗'}`);
        
        // If parser queued it and we need to wait for parsing, poll until it's done
        if (data.queued && waitForParsing) {
          console.log(`[Parser] Processing in background... waiting for completion`);
          const maxWaitTime = 30000; // 30 seconds max
          const pollInterval = 2000; // Poll every 2 seconds
          const startTime = Date.now();
          
          while (Date.now() - startTime < maxWaitTime) {
            await new Promise(resolve => setTimeout(resolve, pollInterval));
            
            // Resubmit to see if it's now cached/processed
            try {
              const pollBuffer = await file.arrayBuffer();
              const pollFormData = new FormData();
              pollFormData.append("file", new Blob([pollBuffer], { type: 'application/octet-stream' }), file.name);
              pollFormData.append("siteId", SITE_ID);
              if (blueprintId) {
                pollFormData.append("customId", blueprintId);
              }
              
              const pollResponse = await fetch(parserUrl.toString(), {
                method: "POST",
                headers: {
                  "x-alchemy-secret": getParserSecret(),
                },
                body: pollFormData,
              });
              
              if (pollResponse.ok) {
                const pollData = await pollResponse.json();
                
                // If we got parsed data back, return it
                if (pollData.duplicate && pollData.parsed) {
                  console.log(`[Parser] ✓ Complete! Blueprint data parsed successfully`);
                  return pollData;
                }
              }
            } catch (pollError) {
              // Silently continue polling on error
            }
          }
          
          console.log(`[Parser] Processing continues in background (will complete shortly)`);
          return data;
        }
        
        return data;
      } catch (error) {
        if (attempt < retries && (error.message.includes("Failed to fetch") || error.message.includes("NetworkError"))) {
          console.log(`[Parser] Network error, retrying...`);
          await new Promise(resolve => setTimeout(resolve, 1000));
          continue;
        }
        throw error;
      }
    }
  } catch (error) {
    console.error("[Parser] Error:", error.message);
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
