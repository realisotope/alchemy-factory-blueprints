import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const PARSER_API_KEY = process.env.PARSER_API_KEY;

export default async function handler(req, res) {
  if (!PARSER_API_KEY) {
    console.error("PARSER_API_KEY environment variable is not set");
    return res.status(500).json({ error: "Server configuration error" });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const providedSecret = req.headers["x-alchemy-secret"];
  if (providedSecret !== PARSER_API_KEY) {
    console.error("Invalid parser secret");
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const { fileHash, parsed, customId } = req.body;

    if (!fileHash || !parsed) {
      return res.status(400).json({ error: "Missing fileHash or parsed data" });
    }

    console.log(`Received parsed data for fileHash: ${fileHash}${customId ? ` (customId: ${customId})` : ""}`);

    let blueprint;
    let findError;
    
    if (customId) {
      const result = await supabase
        .from("blueprints")
        .select("id")
        .eq("id", customId)
        .single();
      blueprint = result.data;
      findError = result.error;
    }
    
    if (!blueprint) {
      const result = await supabase
        .from("blueprints")
        .select("id")
        .eq("filehash", fileHash)
        .single();
      blueprint = result.data;
      findError = result.error;
    }

    if (findError || !blueprint) {
      console.error("Blueprint not found for fileHash:", fileHash);
      return res.status(404).json({ error: "Blueprint not found" });
    }

    // Check if this is a multi-part blueprint
    const { data: blueprintData, error: selectError } = await supabase
      .from("blueprints")
      .select("is_multi_part, parts")
      .eq("id", blueprint.id)
      .single();

    if (selectError) {
      console.error("Error fetching blueprint details:", selectError);
      return res.status(500).json({ error: "Failed to fetch blueprint details" });
    }

    let updateData;

    if (blueprintData.is_multi_part && blueprintData.parts) {
      // Multi-part blueprint - update the specific part's parsed data
      const updatedParts = blueprintData.parts.map(part => {
        if (part.file_hash === fileHash) {
          return { ...part, parsed: parsed };
        }
        return part;
      });

      updateData = {
        parts: updatedParts,
        filehash: fileHash
      };
    } else {
      // Single-part blueprint - update parsed directly
      updateData = {
        parsed: parsed,
        filehash: fileHash
      };
    }

    const { error: updateError } = await supabase
      .from("blueprints")
      .update(updateData)
      .eq("id", blueprint.id);

    if (updateError) {
      console.error("Error updating blueprint:", updateError);
      return res.status(500).json({ error: "Failed to update blueprint" });
    }

    console.log(`Successfully updated blueprint ${blueprint.id} with parsed data`);
    return res.status(200).json({ success: true, blueprintId: blueprint.id });
  } catch (error) {
    console.error("Webhook handler error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
