// SellUp launcher for the CloudLinux Node Selector (lsnode).
const path = require("path");
const fs = require("fs");

try {
  require("dotenv").config({ path: path.join(__dirname, ".env") });
} catch (e) {
  // dotenv unavailable - Next also loads .env itself.
}

// Next standalone binds HOSTNAME; shell-style hostnames (bhs105...) would fail to bind.
const h = process.env.HOSTNAME;
if (h && !/^\d+\.\d+\.\d+\.\d+$/.test(h) && h !== "localhost" && h !== "0.0.0.0") {
  delete process.env.HOSTNAME;
}

try {
  fs.appendFileSync(
    path.join(__dirname, "launcher-debug.log"),
    JSON.stringify({ t: new Date().toISOString(), PORT: process.env.PORT, HOSTNAME: process.env.HOSTNAME, NODE_ENV: process.env.NODE_ENV, BASE: process.env.NEXT_PUBLIC_BASE_DOMAIN }) + "\n"
  );
} catch (e) {
  // ignore
}

// ---------------------------------------------------------------------------
// Static asset server for /_next/static/* — the Next 16.2.6 standalone
// router 404s every static request in this flattened layout, so we intercept
// before Node's http server is created and serve files straight from the
// build output. Everything else falls through to Next.
// ---------------------------------------------------------------------------
const STATIC_ROOT = path.join(__dirname, ".next", "static");
const MIME = {
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".ico": "image/x-icon",
  ".map": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".json": "application/json; charset=utf-8",
};

function serveNextStatic(req, res) {
  try {
    const pathname = (req.url || "").split("?")[0];
    if (!pathname.startsWith("/_next/static/")) return false;
    const rel = decodeURIComponent(pathname.slice("/_next/static/".length));
    const file = path.normalize(path.join(STATIC_ROOT, rel));
    if (!file.startsWith(STATIC_ROOT)) return false; // traversal guard
    const st = fs.statSync(file);
    if (!st.isFile()) return false;
    res.statusCode = 200;
    res.setHeader("Content-Type", MIME[path.extname(file).toLowerCase()] || "application/octet-stream");
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    res.setHeader("Content-Length", st.size);
    fs.createReadStream(file).pipe(res);
    return true;
  } catch (e) {
    return false; // let Next produce its own 404
  }
}

const http = require("http");
const origCreateServer = http.createServer;
http.createServer = function (handler) {
  const wrapped = (req, res) => {
    if (serveNextStatic(req, res)) return;
    return handler(req, res);
  };
  return origCreateServer.call(http, wrapped);
};
// ---------------------------------------------------------------------------

require("./.next/standalone/server.js");
