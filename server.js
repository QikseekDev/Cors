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

// InfiniBrowser API proxy
app.get('/api/recipe', async (req, res) => {
  try {
    const id = req.query.id;
    
    if (!id) {
      return res.status(400).json({ error: 'Missing id parameter' });
    }

    // Construct infinibrowser URL
    const targetUrl = `https://infinibrowser.wiki/api/Recipe?id=${encodeURIComponent(id)}`;

    // Fetch from infinibrowser
    const response = await fetch(targetUrl, {
      method: 'GET',
      redirect: 'follow'
    });

    if (!response.ok) {
      return res.status(response.status).json({ error: `infinibrowser returned ${response.status}` });
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
