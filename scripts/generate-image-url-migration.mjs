import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function argumentValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function sqlLiteral(value) {
  return `'${value.replaceAll("'", "''")}'`;
}

const mappingArgument = argumentValue("--mapping");
if (!mappingArgument) {
  throw new Error("Usage: node scripts/generate-image-url-migration.mjs --mapping <mapping.json> [--reverse]");
}

const mappingPath = path.resolve(root, mappingArgument);
const rawMapping = JSON.parse(await readFile(mappingPath, "utf8"));
if (!Array.isArray(rawMapping) || rawMapping.length === 0) {
  throw new Error("Mapping must be a non-empty JSON array.");
}

const reverse = process.argv.includes("--reverse");
const deduplicated = new Map();
for (const item of rawMapping) {
  const from = reverse ? item?.newUrl : item?.oldUrl;
  const to = reverse ? item?.oldUrl : item?.newUrl;
  if (typeof from !== "string" || typeof to !== "string" || !from || !to) {
    throw new Error("Every mapping item must contain oldUrl and newUrl strings.");
  }
  if (deduplicated.has(from) && deduplicated.get(from) !== to) {
    throw new Error(`Conflicting mapping for ${from}.`);
  }
  deduplicated.set(from, to);
}

const values = [...deduplicated.entries()]
  .map(([oldUrl, newUrl]) => `  (${sqlLiteral(oldUrl)}, ${sqlLiteral(newUrl)})`)
  .join(",\n");
const timestamp = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
const direction = reverse ? "rollback_cloudflare_image_urls" : "update_cloudflare_image_urls";
const migrationFilename = `${timestamp}_${direction}.sql`;
const migrationPath = path.join(root, "supabase", "migrations", migrationFilename);

const scalarUpdates = [
  ["properties", "logo_url"],
  ["room_types", "main_photo_url"],
  ["event_banners", "image_url"],
  ["testimonials", "image_url"],
  ["posts", "featured_image"],
]
  .map(
    ([table, column]) => `UPDATE public."${table}" AS target
SET "${column}" = mapping."new_url"
FROM "_cloudflare_image_url_map" AS mapping
WHERE target."${column}" = mapping."old_url";`,
  )
  .join("\n\n");

const arrayUpdates = [
  ["properties", "photos"],
  ["room_types", "photos"],
  ["rooms", "photos"],
]
  .map(
    ([table, column]) => `UPDATE public."${table}" AS target
SET "${column}" = ARRAY(
  SELECT COALESCE(mapping."new_url", item."url")
  FROM unnest(target."${column}") WITH ORDINALITY AS item("url", "position")
  LEFT JOIN "_cloudflare_image_url_map" AS mapping
    ON mapping."old_url" = item."url"
  ORDER BY item."position"
)
WHERE target."${column}" IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM unnest(target."${column}") AS existing("url")
    JOIN "_cloudflare_image_url_map" AS mapping
      ON mapping."old_url" = existing."url"
  );`,
  )
  .join("\n\n");

const migration = `-- Generated from ${path.basename(mappingPath)}. Review before applying.
BEGIN;

SET search_path TO public;

CREATE TEMP TABLE "_cloudflare_image_url_map" (
  "old_url" text PRIMARY KEY,
  "new_url" text NOT NULL
) ON COMMIT DROP;

INSERT INTO "_cloudflare_image_url_map" ("old_url", "new_url") VALUES
${values};

${scalarUpdates}

${arrayUpdates}

DO $$
DECLARE
  mapping record;
BEGIN
  FOR mapping IN SELECT "old_url", "new_url" FROM "_cloudflare_image_url_map"
  LOOP
    UPDATE public."posts"
    SET "content" = replace("content", mapping."old_url", mapping."new_url")
    WHERE "content" IS NOT NULL
      AND strpos("content", mapping."old_url") > 0;
  END LOOP;
END;
$$;

COMMIT;

-- ROLLBACK:
-- Generate a new migration with this same mapping reversed:
-- node scripts/generate-image-url-migration.mjs --mapping ${mappingArgument.replaceAll("\\", "/")} --reverse
`;

await writeFile(migrationPath, migration, { encoding: "utf8", flag: "wx" });
console.log(`Created ${path.relative(root, migrationPath)} with ${deduplicated.size} URL mappings.`);
