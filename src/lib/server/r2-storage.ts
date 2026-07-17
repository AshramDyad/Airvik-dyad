import "server-only";

import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { randomUUID } from "crypto";

import type { UploadCategory } from "@/lib/uploads";

const IMMUTABLE_CACHE_CONTROL = "public, max-age=31536000, immutable";

const extensionByMimeType: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

type R2Config = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
  publicUrl: string;
};

let cachedClient: S3Client | null = null;

function requireEnvironmentVariable(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing ${name} environment variable.`);
  }

  return value;
}

export function getR2Config(): R2Config {
  return {
    accountId: requireEnvironmentVariable("CLOUDFLARE_R2_ACCOUNT_ID"),
    accessKeyId: requireEnvironmentVariable("CLOUDFLARE_R2_ACCESS_KEY_ID"),
    secretAccessKey: requireEnvironmentVariable("CLOUDFLARE_R2_SECRET_ACCESS_KEY"),
    bucketName: requireEnvironmentVariable("CLOUDFLARE_R2_BUCKET_NAME"),
    publicUrl: requireEnvironmentVariable("NEXT_PUBLIC_CLOUDFLARE_R2_PUBLIC_URL").replace(/\/+$/, ""),
  };
}

function getR2Client(config: R2Config): S3Client {
  if (!cachedClient) {
    cachedClient = new S3Client({
      region: "auto",
      endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
  }

  return cachedClient;
}

function buildObjectKey(category: UploadCategory, mimeType: string, now: Date): string {
  const extension = extensionByMimeType[mimeType];

  if (!extension) {
    throw new Error("Unsupported image type.");
  }

  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${category}/${year}/${month}/${randomUUID()}.${extension}`;
}

export async function uploadImageToR2(
  file: File,
  category: UploadCategory,
): Promise<string> {
  const config = getR2Config();
  const objectKey = buildObjectKey(category, file.type, new Date());
  const bytes = new Uint8Array(await file.arrayBuffer());

  await getR2Client(config).send(
    new PutObjectCommand({
      Bucket: config.bucketName,
      Key: objectKey,
      Body: bytes,
      ContentType: file.type,
      ContentLength: bytes.byteLength,
      CacheControl: IMMUTABLE_CACHE_CONTROL,
      Metadata: {
        "original-filename": file.name.slice(0, 255),
      },
    }),
  );

  return `${config.publicUrl}/${objectKey}`;
}

export function resetR2ClientForTests(): void {
  if (process.env.NODE_ENV === "test") {
    cachedClient = null;
  }
}
