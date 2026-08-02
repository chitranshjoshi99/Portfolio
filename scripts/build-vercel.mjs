import { cp, mkdir, readFile, rm } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const catalogPath = path.join(root, "apps/catalog.json");
const { apps } = JSON.parse(await readFile(catalogPath, "utf8"));
const projects = ["portfolio", ...apps.map((app) => app.project)];
const deployDir = path.join(root, "dist/deploy");
const pnpm = process.platform === "win32" ? "pnpm.cmd" : "pnpm";

execFileSync(
  pnpm,
  ["exec", "nx", "run-many", "-t", "build", `--projects=${projects.join(",")}`],
  { cwd: root, stdio: "inherit" },
);

await rm(deployDir, { recursive: true, force: true });
await mkdir(deployDir, { recursive: true });
await cp(path.join(root, "dist/apps/portfolio"), deployDir, { recursive: true });

for (const app of apps) {
  await cp(
    path.join(root, "dist/apps", app.project),
    path.join(deployDir, "apps", app.slug),
    { recursive: true },
  );
}

console.log(`Built deployment bundle with ${apps.length} published app(s).`);
