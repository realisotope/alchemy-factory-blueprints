import { del as blobDelete } from "@vercel/blob";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { url } = req.body;

  if (!url) {
    return res.status(400).json({ error: "URL is required" });
  }

  try {
    await blobDelete(url, {
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });

    return res.status(200).json({ success: true, message: "Blob deleted successfully" });
  } catch (error) {
    console.error("Error deleting blob:", error);
    return res.status(500).json({ error: error.message || "Failed to delete blob" });
  }
}
