export default async function handler(req, res) {
  // --- Handle OPTIONS preflight ---
  if (req.method === 'OPTIONS') {
    const cors = corsHeaders();
    Object.entries(cors).forEach(([k, v]) => res.setHeader(k, v));
    return res.status(204).end();
  }

  // --- Get target URL from query parameter ---
  const target = req.query.url;
  if (!target) {
    return res.status(400).json({ error: 'Missing `url` parameter' });
  }

  let targetUrl;
  try {
    targetUrl = new URL(target);
  } catch {
    return res.status(400).json({ error: 'Invalid URL' });
  }

  // --- Prevent SSRF (internal network) ---
  const forbidden = ["127.", "localhost", "169.254.", "10.", "172.", "192.168.", "0.0.0.0"];
  if (forbidden.some(f => targetUrl.hostname.startsWith(f))) {
    return res.status(403).json({ error: 'Forbidden - Internal network' });
  }

  // --- Forward the request ---
  let fetchOptions = {
    method: req.method,
    headers: cleanRequestHeaders(req.headers),
    redirect: 'follow'
  };

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    fetchOptions.body = JSON.stringify(req.body);
  }

  let response;
  try {
    response = await fetch(targetUrl.toString(), fetchOptions);
  } catch (err) {
    return res.status(502).json({ error: 'Fetch failed: ' + err.message });
  }

  // --- Clone response headers ---
  const headers = {};
  response.headers.forEach((value, key) => {
    headers[key] = value;
  });

  // --- Remove security headers ---
  const removeHeaders = [
    'x-frame-options',
    'content-security-policy',
    'content-security-policy-report-only',
    'cross-origin-opener-policy',
    'cross-origin-embedder-policy',
    'referrer-policy'
  ];
  removeHeaders.forEach(h => delete headers[h]);

  // --- Add CORS headers ---
  const corsHdrs = corsHeaders();
  Object.assign(headers, corsHdrs);

  // --- Set response headers ---
  Object.entries(headers).forEach(([k, v]) => res.setHeader(k, v));

  // --- Return response body as-is ---
  const buffer = await response.buffer();
  return res.status(response.status).send(buffer);
}

// --- CORS headers ---
function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': '*',
    'Access-Control-Expose-Headers': '*'
  };
}

// --- Clean request headers ---
function cleanRequestHeaders(headers) {
  const cleaned = {};
  const skip = ['host', 'cf-connecting-ip', 'cf-ray', 'content-length'];
  Object.entries(headers).forEach(([k, v]) => {
    if (!skip.includes(k.toLowerCase())) {
      cleaned[k] = v;
    }
  });
  return cleaned;
}
