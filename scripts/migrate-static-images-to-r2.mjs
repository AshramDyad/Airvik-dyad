import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  contentTypeForPath,
  createR2Client,
  getR2ScriptConfig,
  loadLocalEnv,
  publicUrlForKey,
  sha256,
  uploadImmutableObject,
  verifyPublicObject,
} from "./lib/cloudflare-r2.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const publicDirectory = path.join(root, "public");
const sourceDirectory = path.join(root, "src");
const manifestPath = path.join(root, "src", "config", "cloudflare-media-manifest.json");
const dryRun = process.argv.includes("--dry-run");
const skipPublicVerify = process.argv.includes("--skip-public-verify");
const rasterPathPattern = /["'`](\/[^"'`\r\n]+?\.(?:avif|gif|jpe?g|png|webp))["'`]/gi;
const excludedTechnicalAsset = /(?:favicon|placeholder|qr(?:-|_|\.)|\/icons?\/)/i;

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(directory, entry.name);
      return entry.isDirectory() ? walk(entryPath) : [entryPath];
    }),
  );
  return nested.flat();
}

async function collectReferencedAssets() {
  const files = await walk(sourceDirectory);
  const paths = new Set();

  for (const filename of files) {
    if (!/\.(?:css|js|jsx|json|ts|tsx)$/.test(filename)) continue;
    const content = await readFile(filename, "utf8");
    for (const match of content.matchAll(rasterPathPattern)) {
      const publicPath = match[1];
      if (!excludedTechnicalAsset.test(publicPath)) paths.add(publicPath);
    }
  }

  const assets = [];
  for (const publicPath of [...paths].sort()) {
    const filename = path.join(publicDirectory, publicPath.replace(/^\//, ""));
    try {
      const fileStats = await stat(filename);
      if (fileStats.isFile()) assets.push({ publicPath, filename });
    } catch {
      console.warn(`Skipping missing referenced asset: ${publicPath}`);
    }
  }
  return assets;
}

async function main() {
  const assets = await collectReferencedAssets();
  const prepared = [];

  for (const asset of assets) {
    const bytes = await readFile(asset.filename);
    const contentType = contentTypeForPath(asset.filename);
    if (!contentType) continue;
    const digest = sha256(bytes);
    const extension = path.extname(asset.filename).toLowerCase().replace(".jpeg", ".jpg");
    prepared.push({
      ...asset,
      bytes,
      contentType,
      key: `static/${digest.slice(0, 24)}${extension}`,
    });
  }

  const manifest = Object.fromEntries(prepared.map((asset) => [asset.publicPath, asset.key]));
  console.log(`${dryRun ? "Dry run:" : "Migrating"} ${prepared.length} referenced assets.`);

  if (dryRun) {
    console.log(JSON.stringify(manifest, null, 2));
    return;
  }

  loadLocalEnv(root);
  const config = getR2ScriptConfig();
  const client = createR2Client(config);
  const uniqueByKey = new Map(prepared.map((asset) => [asset.key, asset]));

  for (const asset of uniqueByKey.values()) {
    const result = await uploadImmutableObject({
      client,
      config,
      key: asset.key,
      bytes: asset.bytes,
      contentType: asset.contentType,
      originalSource: asset.publicPath,
    });
    const publicUrl = publicUrlForKey(config.publicUrl, asset.key);
    if (!skipPublicVerify) await verifyPublicObject(publicUrl);
    console.log(`${result.uploaded ? "Uploaded" : "Reused"}: ${asset.key}`);
  }

  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  console.log(`Wrote ${path.relative(root, manifestPath)}.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
