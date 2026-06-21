const http = require("http");
const port = parseInt(process.env.PORT || "8080", 10);
let appError = null;
let appLoaded = false;

console.log("[DIAG] Starting diagnostic wrapper on port " + port);
console.log("[DIAG] Node version: " + process.version);
console.log("[DIAG] NODE_ENV: " + process.env.NODE_ENV);
console.log("[DIAG] DATABASE_URL set: " + !!process.env.DATABASE_URL);
console.log("[DIAG] SESSION_SECRET set: " + !!process.env.SESSION_SECRET);
console.log("[DIAG] PHI_ENCRYPTION_KEY set: " + !!process.env.PHI_ENCRYPTION_KEY);

const server = http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({
    status: appLoaded ? "ok" : (appError ? "error" : "loading"),
    error: appError ? appError.message : null,
    stack: appError ? appError.stack : null,
    port: port,
    nodeVersion: process.version,
    timestamp: new Date().toISOString()
  }));
});

server.listen(port, "0.0.0.0", () => {
  console.log("[DIAG] Diagnostic server listening on port " + port);
  
  // Override PORT so the main app picks a different port (or we handle the conflict)
  process.env.PORT = String(port + 1);
  
  try {
    require("./dist/index.cjs");
    appLoaded = true;
    console.log("[DIAG] Main app loaded successfully (will listen on port " + (port + 1) + ")");
  } catch(err) {
    appError = err;
    console.error("[DIAG] FATAL: Failed to load main app:");
    console.error(err.message);
    console.error(err.stack);
  }
});

process.on("uncaughtException", (err) => {
  appError = err;
  console.error("[DIAG] Uncaught exception:", err.message);
  console.error(err.stack);
});

process.on("unhandledRejection", (reason) => {
  console.error("[DIAG] Unhandled rejection:", reason);
});
