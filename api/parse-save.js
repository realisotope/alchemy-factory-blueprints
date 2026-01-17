/**
 * Save Parser
 */

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { saveFile } = req.body;

  if (!saveFile) {
    return res.status(400).json({ error: 'No save file provided' });
  }

  try {
    // Set up SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');

    const formData = new FormData();
    
    // Convert base64 or blob to file if needed
    if (typeof saveFile === 'string') {
      const buffer = Buffer.from(saveFile, 'base64');
      formData.append('save', new Blob([buffer], { type: 'application/octet-stream' }), 'save.dat');
    } else {
      formData.append('save', saveFile);
    }

    const parserResponse = await fetch('https://alchemy-save-parser.faulty.ws/uploadTest', {
      method: 'POST',
      body: formData,
    });

    if (!parserResponse.ok) {
      throw new Error(`Parser returned ${parserResponse.status}`);
    }

    const reader = parserResponse.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        res.write('data: [DONE]\n\n');
        res.end();
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');

      for (let i = 0; i < lines.length - 1; i++) {
        const line = lines[i];

        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          res.write(`data: ${data}\n\n`);
        } else if (line.startsWith('event: ')) {
          const event = line.slice(7);
          res.write(`event: ${event}\n`);
        }
      }

      buffer = lines[lines.length - 1];
    }
  } catch (error) {
    console.error('Save parser error:', error);
    res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
    res.end();
  }
}
