const express = require('express');
const app = express();

// CORS middleware
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.header('Access-Control-Allow-Headers', '*');
  
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

// Health check
app.get('/', (req, res) => {
  res.json({ status: 'InfiniBrowser CORS Proxy' });
});

// InfiniBrowser API proxy with spoofing
app.get('/api/recipe', async (req, res) => {
  try {
    const id = req.query.id;
    
    if (!id) {
      return res.status(400).json({ error: 'Missing id parameter' });
    }

    // Construct infinibrowser URL
    const targetUrl = `https://infinibrowser.wiki/api/Recipe?id=${encodeURIComponent(id)}`;

    // Spoof headers to look like real browser request
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'application/json, text/plain, */*',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'DNT': '1',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
      'Sec-Fetch-Dest': 'empty',
      'Sec-Fetch-Mode': 'cors',
      'Sec-Fetch-Site': 'same-site',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
      'Referer': 'https://infinibrowser.wiki/',
      'Origin': 'https://infinibrowser.wiki',
      'X-Requested-With': 'XMLHttpRequest'
    };

    // Fetch from infinibrowser with spoofed headers
    const response = await fetch(targetUrl, {
      method: 'GET',
      redirect: 'follow',
      headers: headers
    });

    console.log(`Fetch status: ${response.status} for id: ${id}`);

    if (!response.ok) {
      return res.status(response.status).json({ error: `infinibrowser returned ${response.status}`, status: response.status });
    }

    const data = await response.json();
    return res.json(data);

  } catch (err) {
    console.error('Proxy error:', err);
    res.status(502).json({ error: 'Fetch failed: ' + err.message });
  }
});

// Export for Vercel
module.exports = app;

// Local dev
if (require.main === module) {
  const port = process.env.PORT || 3000;
  app.listen(port, () => {
    console.log(`InfiniBrowser Proxy on port ${port}`);
  });
}
