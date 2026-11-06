import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
const root = process.cwd(),
  out = path.join(root, "CandidateTracker"),
  cache = path.join(root, ".runtime-cache");
await fs.mkdir(out, { recursive: true });
await fs.mkdir(cache, { recursive: true });
await fs.rm(path.join(out, "app"), { recursive: true, force: true });
await fs.cp(path.join(root, "dist"), path.join(out, "app"), {
  recursive: true,
});
await fs.copyFile("server.cjs", path.join(out, "server.cjs"));
const base = "https://nodejs.org/dist/latest-v22.x";
const checks = await (await fetch(`${base}/SHASUMS256.txt`)).text();
if (!checks.includes("darwin-arm64"))
  throw Error("Unable to retrieve official Node checksums.");
const version = checks.match(/node-(v[\d.]+)-darwin-arm64/)?.[1];
if (!version) throw Error("Runtime version not found");
await fs.writeFile(path.join(out, "RUNTIME-CHECKSUMS.txt"), checks);
for (const target of ["darwin-arm64", "darwin-x64", "win-x64", "win-arm64"]) {
  const filename = `node-${version}-${target}.${target.startsWith("win") ? "zip" : "tar.gz"}`,
    dest = path.join(cache, filename);
  try {
    await fs.access(dest);
  } catch {
    console.log("Downloading", filename);
    const response = await fetch(`${base}/${filename}`);
    if (!response.ok) throw Error(`Download failed: ${response.status}`);
    await fs.writeFile(dest, Buffer.from(await response.arrayBuffer()));
  }
  const hash = crypto
    .createHash("sha256")
    .update(await fs.readFile(dest))
    .digest("hex");
  if (
    !checks
      .split("\n")
      .some((line) => line.startsWith(hash) && line.endsWith(filename))
  )
    throw Error(`Checksum mismatch: ${filename}`);
  const unpack = path.join(cache, target);
  await fs.mkdir(unpack, { recursive: true });
  execFileSync(
    target.startsWith("win") ? "unzip" : "tar",
    target.startsWith("win")
      ? ["-o", "-q", dest, "-d", unpack]
      : ["-xzf", dest, "-C", unpack],
  );
  const runtime = path.join(out, "runtime", target);
  await fs.mkdir(runtime, { recursive: true });
  await fs.copyFile(
    path.join(
      unpack,
      `node-${version}-${target}`,
      target.startsWith("win") ? "node.exe" : "bin/node",
    ),
    path.join(runtime, target.startsWith("win") ? "node.exe" : "node"),
  );
  if (!target.startsWith("win"))
    await fs.chmod(path.join(runtime, "node"), 0o755);
  await fs.copyFile(
    path.join(unpack, `node-${version}-${target}`, "LICENSE"),
    path.join(runtime, "LICENSE"),
  );
  console.log("Verified and bundled", target);
}
await fs.writeFile(
  path.join(out, "launch-macos.command"),
  `#!/bin/bash\ncd "$(dirname "$0")" || exit 1\nARCH="$(uname -m)"\nif [ "$ARCH" = "arm64" ]; then RUNTIME="darwin-arm64"; else RUNTIME="darwin-x64"; fi\n"./runtime/$RUNTIME/node" ./server.cjs\nRESULT=$?\nif [ "$RESULT" -ne 0 ]; then echo "Launch failed. Read README.md for troubleshooting."; read -r -p "Press Return to close."; fi\n`,
);
await fs.chmod(path.join(out, "launch-macos.command"), 0o755);
await fs.writeFile(
  path.join(out, "launch-windows.cmd"),
  '@echo off\r\ncd /d "%~dp0"\r\nset "CT_RUNTIME=win-x64"\r\nif /I "%PROCESSOR_ARCHITECTURE%"=="ARM64" set "CT_RUNTIME=win-arm64"\r\nif /I "%PROCESSOR_ARCHITEW6432%"=="ARM64" set "CT_RUNTIME=win-arm64"\r\n"runtime\\%CT_RUNTIME%\\node.exe" "server.cjs"\r\nif errorlevel 1 pause\r\n',
);
for (const f of [
  "README.md",
  "LICENSE",
  "USER-GUIDE.md",
  "BACKUP-GUIDE.md",
  "THIRD-PARTY-NOTICES.txt",
  "TEST-REPORT.md",
  "DEVELOPER-GUIDE.md",
  "SECURITY.md",
  "CONTRIBUTING.md",
])
  await fs.copyFile(f, path.join(out, f));
await fs.cp("templates", path.join(out, "templates"), { recursive: true });
await fs.writeFile(
  path.join(out, "BUILD-INFO.json"),
  JSON.stringify(
    {
      application: "1.0.0",
      author: "Sheheryar Ahmad",
      runtime: version,
      built: new Date().toISOString(),
      origin: "http://127.0.0.1:47831",
    },
    null,
    2,
  ),
);
console.log("Distribution ready:", out);
