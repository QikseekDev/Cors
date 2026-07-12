const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

// CORS proxy route
app.get('/api/cors', async (req, res) => {
  const target = req.query.url;
  if (!target) return res.status(400).json({ error: 'Missing url parameter' });

  try {
    const targetUrl = new URL(target);
    
    // SSRF prevention
    const forbidden = ["127.", "localhost", "169.254.", "10.", "172.", "192.168.", "0.0.0.0"];
    if (forbidden.some(f => targetUrl.hostname.startsWith(f))) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const response = await fetch(targetUrl.toString());
    const data = await response.json();

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// Health check
app.get('/', (req, res) => {
  res.send('CORS Proxy running');
});

app.listen(port, () => {
  console.log(`Server on port ${port}`);
});
