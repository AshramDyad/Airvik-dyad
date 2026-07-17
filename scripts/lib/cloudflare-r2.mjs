import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import {
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

const MIME_BY_EXTENSION = {
  ".avif": "image/avif",
  ".gif": "image/gif",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
};

const EXTENSION_BY_MIME = {
  "image/avif": ".avif",
  "image/gif": ".gif",
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/svg+xml": ".svg",
  "image/webp": ".webp",
};

function parseEnvLine(line) {
  const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
  if (!match) return null;

  let value = match[2];
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }

  return [match[1], value.replace(/\\n/g, "\n")];
}

export function loadLocalEnv(rootDirectory) {
  for (const filename of [".env.local", ".env.local.dev", ".env"]) {
    const filenamePath = path.join(rootDirectory, filename);
    if (!existsSync(filenamePath)) continue;

    for (const line of readFileSync(filenamePath, "utf8").split(/\r?\n/)) {
      if (!line.trim() || line.trimStart().startsWith("#")) continue;
      const parsed = parseEnvLine(line);
      if (parsed && process.env[parsed[0]] === undefined) {
        process.env[parsed[0]] = parsed[1];
      }
    }
  }
}

function requireEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing ${name}.`);
  return value;
}

export function getR2ScriptConfig() {
  const accountId = requireEnv("CLOUDFLARE_R2_ACCOUNT_ID");
  return {
    accountId,
    accessKeyId: requireEnv("CLOUDFLARE_R2_ACCESS_KEY_ID"),
    secretAccessKey: requireEnv("CLOUDFLARE_R2_SECRET_ACCESS_KEY"),
    bucketName: requireEnv("CLOUDFLARE_R2_BUCKET_NAME"),
    publicUrl: requireEnv("NEXT_PUBLIC_CLOUDFLARE_R2_PUBLIC_URL").replace(/\/+$/, ""),
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  };
}

export function createR2Client(config) {
  return new S3Client({
    region: "auto",
    endpoint: config.endpoint,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
}

export function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

export function contentTypeForPath(filename) {
  return MIME_BY_EXTENSION[path.extname(filename).toLowerCase()] ?? null;
}

export function extensionForContentType(contentType, sourceUrl = "") {
  const normalized = contentType?.split(";", 1)[0].trim().toLowerCase();
  if (normalized && EXTENSION_BY_MIME[normalized]) return EXTENSION_BY_MIME[normalized];

  try {
    const extension = path.extname(new URL(sourceUrl).pathname).toLowerCase();
    return MIME_BY_EXTENSION[extension] ? extension : null;
  } catch {
    return null;
  }
}

export function publicUrlForKey(publicUrl, key) {
  const encodedKey = key
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return `${publicUrl.replace(/\/+$/, "")}/${encodedKey}`;
}

export async function uploadImmutableObject({
  client,
  config,
  key,
  bytes,
  contentType,
  originalSource,
}) {
  try {
    await client.send(new HeadObjectCommand({ Bucket: config.bucketName, Key: key }));
    return { uploaded: false, key };
  } catch (error) {
    const statusCode = error?.$metadata?.httpStatusCode;
    if (statusCode && statusCode !== 404) throw error;
  }

  await client.send(
    new PutObjectCommand({
      Bucket: config.bucketName,
      Key: key,
      Body: bytes,
      ContentLength: bytes.byteLength,
      ContentType: contentType,
      CacheControl: "public, max-age=31536000, immutable",
      Metadata: {
        "original-source": encodeURIComponent(originalSource).slice(0, 900),
      },
    }),
  );

  return { uploaded: true, key };
}

export async function verifyPublicObject(url) {
  const response = await fetch(url, { method: "HEAD", redirect: "follow" });
  if (!response.ok) {
    throw new Error(`Public verification failed for ${url}: HTTP ${response.status}`);
  }
}
