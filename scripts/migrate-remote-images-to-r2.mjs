import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  createR2Client,
  extensionForContentType,
  getR2ScriptConfig,
  loadLocalEnv,
  publicUrlForKey,
  sha256,
  uploadImmutableObject,
  verifyPublicObject,
} from "./lib/cloudflare-r2.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function argumentValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const inventoryArgument = argumentValue("--inventory");
if (!inventoryArgument) {
  throw new Error("Usage: node scripts/migrate-remote-images-to-r2.mjs --inventory <inventory.json> [--output <mapping.json>]");
}

loadLocalEnv(root);
const inventoryPath = path.resolve(root, inventoryArgument);
const outputPath = path.resolve(
  root,
  argumentValue("--output") ?? "supabase/backups/cloudflare-image-url-map.json",
);
const inventory = JSON.parse(await readFile(inventoryPath, "utf8"));
if (!Array.isArray(inventory)) throw new Error("Inventory must be a JSON array.");

const config = getR2ScriptConfig();
const client = createR2Client(config);
const mapping = [];

for (const item of inventory) {
  const oldUrl = typeof item === "string" ? item : item?.url;
  if (typeof oldUrl !== "string" || !oldUrl.startsWith("https://")) {
    throw new Error("Every inventory item must contain an HTTPS url.");
  }

  const response = await fetch(oldUrl, { redirect: "follow" });
  if (!response.ok) throw new Error(`Could not download ${oldUrl}: HTTP ${response.status}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  const contentType = response.headers.get("content-type")?.split(";", 1)[0] ?? "";
  const extension = extensionForContentType(contentType, oldUrl);
  if (!extension || !contentType.startsWith("image/")) {
    throw new Error(`Unsupported image response for ${oldUrl}: ${contentType || "unknown type"}`);
  }

  const digest = sha256(bytes);
  const key = `migrated/${digest.slice(0, 24)}${extension}`;
  await uploadImmutableObject({
    client,
    config,
    key,
    bytes,
    contentType,
    originalSource: oldUrl,
  });
  const newUrl = publicUrlForKey(config.publicUrl, key);
  await verifyPublicObject(newUrl);
  mapping.push({ oldUrl, newUrl });
  console.log(`Migrated ${oldUrl}`);
}

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(mapping, null, 2)}\n`, "utf8");
console.log(`Wrote ${mapping.length} URL mappings to ${path.relative(root, outputPath)}.`);
