#!/usr/bin/env node
/**
 * Development server wrapper for Replit artifact workflow.
 *
 * Opens port 20384 immediately (required for health check),
 * then spawns Metro bundler in the background on port 8081.
 *
 * Architecture:
 *   - HTTP server on 0.0.0.0:20384 → serves static build + proxies to Metro
 *   - Metro on port 8081 with CI=1 (no stdin required)
 */

const http = require("http");
const net = require("net");
const path = require("path");
const fs = require("fs");
const { spawn } = require("child_process");

const PORT = parseInt(process.env.PORT || "20384", 10);
const METRO_PORT = 8081;
const STATIC_ROOT = path.resolve(__dirname, "..", "static-build");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".map": "application/json",
};

function proxyToMetro(req, res) {
  const options = {
    hostname: "127.0.0.1",
    port: METRO_PORT,
    path: req.url,
    method: req.method,
    headers: req.headers,
  };

  const proxyReq = http.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res, { end: true });
  });

  proxyReq.on("error", () => {
    serveStatic(req, res);
  });

  req.pipe(proxyReq, { end: true });
}

function serveStatic(req, res) {
  const urlPath = req.url.split("?")[0];

  if (urlPath === "/" || urlPath === "") {
    const indexPath = path.join(STATIC_ROOT, "index.html");
    if (fs.existsSync(indexPath)) {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(fs.readFileSync(indexPath));
      return;
    }
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(
      "<!DOCTYPE html><html><body><h1>MuhKam ERP Mobile</h1><p>Metro bundler starting...</p></body></html>"
    );
    return;
  }

  const safePath = path.normalize(urlPath).replace(/^(\.\.(\/|\\|$))+/, "");
  const filePath = path.join(STATIC_ROOT, safePath);

  if (!filePath.startsWith(STATIC_ROOT)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    const indexPath = path.join(STATIC_ROOT, "index.html");
    if (fs.existsSync(indexPath)) {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(fs.readFileSync(indexPath));
    } else {
      res.writeHead(404);
      res.end("Not Found");
    }
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME[ext] || "application/octet-stream";
  res.writeHead(200, { "content-type": contentType });
  res.end(fs.readFileSync(filePath));
}

function isMetroBundleRequest(url) {
  return (
    url.includes(".bundle") ||
    url.includes("hot") ||
    url.startsWith("/__") ||
    url.includes("symbolicate") ||
    url.includes("debugger") ||
    url.includes("status")
  );
}

const server = http.createServer((req, res) => {
  if (isMetroBundleRequest(req.url)) {
    proxyToMetro(req, res);
  } else {
    serveStatic(req, res);
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`[dev-server] Listening on port ${PORT}`);
  startMetro();
});

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.log(`[dev-server] Port ${PORT} already in use, proceeding anyway`);
    startMetro();
    keepAlive();
  } else {
    console.error("[dev-server] Server error:", err.message);
    process.exit(1);
  }
});

let metroProcess = null;

function startMetro() {
  const env = {
    ...process.env,
    CI: "1",
    PORT: String(METRO_PORT),
  };

  console.log(`[dev-server] Starting Metro on port ${METRO_PORT}...`);

  metroProcess = spawn(
    "pnpm",
    ["exec", "expo", "start", "--port", String(METRO_PORT)],
    {
      env,
      stdio: "inherit",
      cwd: path.resolve(__dirname, ".."),
    }
  );

  metroProcess.on("error", (err) => {
    console.error("[dev-server] Metro spawn error:", err.message);
  });

  metroProcess.on("exit", (code, signal) => {
    console.log(`[dev-server] Metro exited: code=${code} signal=${signal}`);
  });
}

function keepAlive() {
  setInterval(() => {}, 30000);
}

process.on("SIGTERM", () => {
  console.log("[dev-server] Received SIGTERM, shutting down...");
  if (metroProcess) metroProcess.kill("SIGTERM");
  server.close();
  process.exit(0);
});

process.on("SIGINT", () => {
  if (metroProcess) metroProcess.kill("SIGTERM");
  server.close();
  process.exit(0);
});
