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

export async function sendBlueprintToParser(file, blueprintId = null) {
  try {
    const formData = new FormData();
    formData.append("file", file, file.name);
    formData.append("siteId", SITE_ID);
    
    if (blueprintId) {
      formData.append("customId", blueprintId);
    }

    const response = await fetch(PARSER_API_URL, {
      method: "POST",
      headers: {
        "x-alchemy-secret": getParserSecret(),
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Parser API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    return data;
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
