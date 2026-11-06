"use strict";
// Read-only loopback file server. No application data is sent to this process.
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");
const ROOT = path.join(__dirname, "app");
const HOST = "127.0.0.1";
const PORT = 47831;
const URL = `http://${HOST}:${PORT}`;
const ID = "candidate-tracker-offline-v1";
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".json": "application/json",
  ".woff2": "font/woff2",
};
function openBrowser() {
  if (process.env.CANDIDATE_TRACKER_NO_OPEN) return;
  const command =
    process.platform === "win32"
      ? "cmd"
      : process.platform === "darwin"
        ? "open"
        : "xdg-open";
  const args = process.platform === "win32" ? ["/c", "start", "", URL] : [URL];
  const p = spawn(command, args, { stdio: "ignore", windowsHide: true });
  p.on("error", () => console.log(`Open ${URL} in your browser.`));
}
const server = http.createServer((req, res) => {
  const headers = {
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "Cache-Control": "no-store",
    "Cross-Origin-Resource-Policy": "same-origin",
    "Content-Security-Policy":
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; font-src 'self'; connect-src 'self'; object-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
  };
  if (req.headers.host !== `${HOST}:${PORT}`) {
    res.writeHead(403, headers);
    return res.end("Invalid host");
  }
  if (!["GET", "HEAD"].includes(req.method)) {
    res.writeHead(405, headers);
    return res.end("Read only");
  }
  if (req.url === "/__candidate_tracker_health") {
    res.writeHead(200, { ...headers, "Content-Type": "text/plain" });
    return res.end(ID);
  }
  let decoded;
  try {
    decoded = decodeURIComponent((req.url || "/").split("?")[0]);
  } catch {
    res.writeHead(400, headers);
    return res.end("Invalid path");
  }
  const filename = path.resolve(
    ROOT,
    "." + (decoded === "/" ? "/index.html" : decoded),
  );
  if (!filename.startsWith(ROOT + path.sep)) {
    res.writeHead(403, headers);
    return res.end("Forbidden");
  }
  fs.stat(filename, (err, stat) => {
    if (err || !stat.isFile()) {
      res.writeHead(404, headers);
      return res.end("Not found");
    }
    res.writeHead(200, {
      ...headers,
      "Content-Type":
        types[path.extname(filename)] || "application/octet-stream",
      "Content-Length": stat.size,
    });
    if (req.method === "HEAD") res.end();
    else
      fs.createReadStream(filename)
        .on("error", () => res.destroy())
        .pipe(res);
  });
});
server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    const req = http.get(`${URL}/__candidate_tracker_health`, (res) => {
      let body = "";
      res.on("data", (d) => (body += d));
      res.on("end", () => {
        if (body === ID) {
          console.log("Candidate Tracker is already running.");
          openBrowser();
        } else {
          console.error(
            `Port ${PORT} is occupied by another app. Close that app and relaunch. The port will not change because your data belongs to this address.`,
          );
          process.exitCode = 1;
        }
      });
    });
    req.setTimeout(3000, () => req.destroy());
    req.on("error", () => {
      console.error("Cannot verify the existing local server.");
      process.exitCode = 1;
    });
  } else {
    console.error(err.message);
    process.exitCode = 1;
  }
});
server.listen(PORT, HOST, () => {
  console.log(
    `Candidate Tracker is running at ${URL}\nKeep this window open while using the app. Press Ctrl+C to stop.\nUse the same browser and profile each time. Create regular backups.`,
  );
  openBrowser();
});
