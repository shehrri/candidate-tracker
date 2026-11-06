import fs from "node:fs/promises";
import path from "node:path";
const lock = JSON.parse(await fs.readFile("package-lock.json", "utf8"));
let text =
  "Candidate Tracker — Third-party dependency notices\n\nConservative inventory of production dependency licenses. Browser bundles contain a subset of these packages. Node runtime licenses are supplied separately under runtime/.\n\n";
for (const [folder, pkg] of Object.entries(lock.packages)) {
  if (!folder || pkg.dev) continue;
  try {
    const manifest = JSON.parse(
      await fs.readFile(path.join(folder, "package.json"), "utf8"),
    );
    text += `\n${"=".repeat(72)}\n${manifest.name} ${manifest.version} — ${JSON.stringify(manifest.license || "See source license")}\n`;
    const names = await fs.readdir(folder);
    for (const name of names.filter((n) =>
      /^(license|licence|copying|notice)(\.|$)/i.test(n),
    )) {
      const stat = await fs.stat(path.join(folder, name));
      if (stat.isFile())
        text += `\n${name}\n${await fs.readFile(path.join(folder, name), "utf8")}\n`;
    }
  } catch {}
}
await fs.writeFile("THIRD-PARTY-NOTICES.txt", text.replace(/\r\n/g, "\n").replace(/[ \t]+$/gm, "").trimEnd() + "\n");
console.log("Third-party license notices generated.");
