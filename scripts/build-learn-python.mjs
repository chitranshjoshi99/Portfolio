import { cp, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const appRoot = path.join(root, "apps/learn-python");
const output = path.join(root, "dist/apps/learn-python");

// Learn Python is deliberately browser-native: its inline module imports Three.js
// through an import map. Copying the static app keeps that import map intact.
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await cp(path.join(appRoot, "public"), output, { recursive: true });
await cp(path.join(appRoot, "index.html"), path.join(output, "index.html"));

console.log("Built learn-python → dist/apps/learn-python");
