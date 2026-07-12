export default async function handler(req, res) {
  // --- Handle OPTIONS preflight ---
  if (req.method === 'OPTIONS') {
    setCorsHeaders(res);
    return res.status(204).end();
  }

  // --- Get target URL from query parameter ---
  const target = req.query.url;
  if (!target) {
    setCorsHeaders(res);
    return res.status(400).json({ error: 'Missing `url` parameter' });
  }

  let targetUrl;
  try {
    targetUrl = new URL(target);
  } catch {
    setCorsHeaders(res);
    return res.status(400).json({ error: 'Invalid URL' });
  }

  // --- Prevent SSRF (internal network) ---
  const forbidden = ["127.", "localhost", "169.254.", "10.", "172.", "192.168.", "0.0.0.0"];
  if (forbidden.some(f => targetUrl.hostname.startsWith(f))) {
    setCorsHeaders(res);
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
    setCorsHeaders(res);
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
  const cors = getCorsHeaders();
  Object.assign(headers, cors);

  const contentType = headers['content-type'] || '';

  // --- HTML rewriting ---
  if (contentType.includes('text/html')) {
    let html = await response.text();
    html = rewriteHtml(html, targetUrl);
    Object.entries(headers).forEach(([k, v]) => res.setHeader(k, v));
    return res.status(response.status).send(html);
  }

  // --- Binary fallback ---
  Object.entries(headers).forEach(([k, v]) => res.setHeader(k, v));
  const buffer = await response.buffer();
  return res.status(response.status).send(buffer);
}

// --- CORS headers ---
function getCorsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': '*',
    'Access-Control-Expose-Headers': '*'
  };
}

function setCorsHeaders(res) {
  const cors = getCorsHeaders();
  Object.entries(cors).forEach(([k, v]) => res.setHeader(k, v));
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

// --- Rewrite HTML for proxying ---
function rewriteHtml(html, baseUrl) {
  const proxyPrefix = 'https://your-domain.vercel.app/api/proxy?url=';

  function toAbsolute(url) {
    try {
      return new URL(url, baseUrl).toString();
    } catch {
      return url;
    }
  }

  function proxify(url) {
    if (!url || url.startsWith('data:') || url.startsWith('javascript:') || url.startsWith('#')) return url;
    return proxyPrefix + encodeURIComponent(toAbsolute(url));
  }

  if (/<head[^>]*>/i.test(html)) {
    html = html.replace(/<head[^>]*>/i, match => `${match}<base href="${baseUrl.origin}/">`);
  }

  html = html.replace(/(href|src|action)=["'](.*?)["']/gi, (m, attr, url) => `${attr}="${proxify(url)}"`);

  html = html.replace(/srcset=["'](.*?)["']/gi, (match, value) => {
    const parts = value.split(',').map(part => {
      const [url, size] = part.trim().split(/\s+/);
      return `${proxify(url)} ${size || ''}`.trim();
    });
    return `srcset="${parts.join(', ')}"`;
  });

  html = html.replace(/(href|src)=["']\/\/(.*?)["']/gi, (m, attr, url) => `${attr}="${proxify('https://' + url)}"`);

  html = html.replace(/url\(["']?(.*?)["']?\)/gi, (m, url) => (!url || url.startsWith('data:') ? m : `url("${proxify(url)}")`));

  return html;
                      }
