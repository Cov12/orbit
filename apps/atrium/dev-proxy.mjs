/**
 * Atrium Dev Preview Proxy
 * Token-gated reverse proxy for mobile testing.
 * 
 * Routes:
 *   /api, /auth, /ollama, /openai, /audio, /images, /retrieval, /socket.io → backend (3000)
 *   Everything else → Vite dev server (5173)
 * 
 * Usage: node dev-proxy.mjs
 * Visit: http://<vps-ip>:8080?token=<token>
 */

import http from 'node:http';
import crypto from 'node:crypto';

const PROXY_PORT = 8080;
const VITE_TARGET = 'http://127.0.0.1:5173';
const BACKEND_TARGET = 'http://127.0.0.1:3000';
const ACCESS_TOKEN = process.env.ACCESS_TOKEN || 'a822beafb6dd3a327d80e6ce8111c442';
const COOKIE_NAME = 'aos_dev';
const COOKIE_SECRET = crypto.randomBytes(32).toString('hex');
const VALID_COOKIE = crypto.createHmac('sha256', COOKIE_SECRET).update('authorized').digest('hex').slice(0, 32);

// Paths that go to the Python backend
const BACKEND_PREFIXES = ['/api/', '/auth/', '/ollama/', '/openai/', '/audio/', '/images/', '/retrieval/', '/socket.io/'];

function isBackendRoute(url) {
  const path = url.split('?')[0];
  return BACKEND_PREFIXES.some(p => path.startsWith(p));
}

function isAuthorized(req) {
  const cookies = (req.headers.cookie || '').split(';').reduce((acc, c) => {
    const [k, v] = c.trim().split('=');
    if (k) acc[k] = v;
    return acc;
  }, {});
  return cookies[COOKIE_NAME] === VALID_COOKIE;
}

function checkToken(url) {
  try {
    const u = new URL(url, 'http://localhost');
    return u.searchParams.get('token') === ACCESS_TOKEN;
  } catch { return false; }
}

function proxyRequest(req, res, target) {
  const targetUrl = new URL(req.url, target);
  const proxyReq = http.request(targetUrl, {
    method: req.method,
    headers: { ...req.headers, host: targetUrl.host },
  }, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res);
  });

  proxyReq.on('error', (err) => {
    console.error(`Proxy error (${target}):`, err.message);
    if (!res.headersSent) {
      res.writeHead(502, { 'Content-Type': 'text/html' });
      res.end(`<h1>502 — Upstream not responding</h1><p>${target}: ${err.message}</p>`);
    }
  });

  req.pipe(proxyReq);
}

const server = http.createServer((req, res) => {
  // Token in URL → set cookie and redirect
  if (checkToken(req.url)) {
    const u = new URL(req.url, 'http://localhost');
    u.searchParams.delete('token');
    const cleanPath = u.pathname + (u.search || '');
    res.writeHead(302, {
      'Set-Cookie': `${COOKIE_NAME}=${VALID_COOKIE}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400`,
      'Location': cleanPath || '/'
    });
    return res.end();
  }

  // Check cookie
  if (!isAuthorized(req)) {
    res.writeHead(401, { 'Content-Type': 'text/html' });
    return res.end('<h1>401 — Access token required</h1><p>Append <code>?token=YOUR_TOKEN</code> to the URL.</p>');
  }

  // Route to backend or vite
  const target = isBackendRoute(req.url) ? BACKEND_TARGET : VITE_TARGET;
  proxyRequest(req, res, target);
});

// WebSocket upgrades (Vite HMR + socket.io)
server.on('upgrade', (req, socket, head) => {
  if (!isAuthorized(req)) {
    socket.destroy();
    return;
  }

  const target = isBackendRoute(req.url) ? BACKEND_TARGET : VITE_TARGET;
  const targetUrl = new URL(req.url, target);
  const proxyReq = http.request(targetUrl, {
    method: 'GET',
    headers: { ...req.headers, host: targetUrl.host },
  });

  proxyReq.on('upgrade', (proxyRes, proxySocket, proxyHead) => {
    socket.write(
      `HTTP/1.1 101 Switching Protocols\r\n` +
      Object.entries(proxyRes.headers).map(([k, v]) => `${k}: ${v}`).join('\r\n') +
      '\r\n\r\n'
    );
    proxySocket.write(head);
    proxySocket.pipe(socket);
    socket.pipe(proxySocket);
  });

  proxyReq.on('error', () => { try { socket.destroy(); } catch {} });
  proxyReq.end();
});

// Prevent crashes on connection resets
server.on('clientError', (err, socket) => {
  if (err.code === 'ECONNRESET' || err.code === 'HPE_HEADER_OVERFLOW') {
    try { socket.destroy(); } catch {}
    return;
  }
});

process.on('uncaughtException', (err) => {
  if (err.code === 'ECONNRESET' || err.code === 'EPIPE') {
    console.warn('Connection reset (ignored):', err.code);
    return;
  }
  console.error('Uncaught:', err);
  process.exit(1);
});

server.listen(PROXY_PORT, '0.0.0.0', () => {
  console.log(`🔒 Auth proxy on http://0.0.0.0:${PROXY_PORT}`);
  console.log(`📱 Access: http://<your-ip>:${PROXY_PORT}?token=${ACCESS_TOKEN}`);
  console.log(`   Frontend (Vite): ${VITE_TARGET}`);
  console.log(`   Backend (API):   ${BACKEND_TARGET}`);
  console.log(`   Cookie valid 24h`);
});
