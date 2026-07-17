import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function argumentValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const dumpArgument = argumentValue("--dump");
if (!dumpArgument) {
  throw new Error("Usage: node scripts/extract-supabase-image-urls.mjs --dump <data-dump.sql> [--output <inventory.json>]");
}

const dumpPath = path.resolve(root, dumpArgument);
const outputPath = path.resolve(
  root,
  argumentValue("--output") ?? "supabase/backups/cloudflare-image-url-inventory.json",
);
const dump = await readFile(dumpPath, "utf8");
const urlPattern = /https:\/\/[a-z0-9-]+\.supabase\.co\/storage\/v1\/object\/public\/images\/[A-Za-z0-9%._~!$&()*+;=:@\/-]+/gi;
const urls = [...new Set(dump.match(urlPattern) ?? [])].sort();
const inventory = urls.map((url) => ({ url, category: "migrated" }));

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(inventory, null, 2)}\n`, "utf8");
console.log(`Extracted ${inventory.length} Supabase image URLs to ${path.relative(root, outputPath)}.`);
