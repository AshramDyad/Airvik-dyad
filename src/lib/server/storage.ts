"use server";

import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";
import { IMAGE_ASSET_CACHE_CONTROL_SECONDS } from "@/lib/server/storage-config";

const bucketName = "images";
const maxFileSizeBytes = 5 * 1024 * 1024; // 5MB default limit

type ServiceClient = SupabaseClient;

let cachedClient: ServiceClient | null = null;
let hasEnsuredBucket = false;

function getServiceSupabaseConfig(): { url: string; serviceRoleKey: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL environment variable.");
  }

  if (!serviceRoleKey) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY environment variable.");
  }

  return { url, serviceRoleKey };
}

function getServiceSupabaseClient(): ServiceClient {
  if (cachedClient) {
    return cachedClient;
  }

  const config = getServiceSupabaseConfig();

  cachedClient = createClient(config.url, config.serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return cachedClient;
}

export async function ensureImagesBucket(): Promise<void> {
  if (hasEnsuredBucket) {
    return;
  }

  const supabase = getServiceSupabaseClient();
  const { data: buckets, error: listError } = await supabase.storage.listBuckets();

  if (listError) {
    throw listError;
  }

  const bucketExists = buckets?.some((bucket) => bucket.name === bucketName);

  if (!bucketExists) {
    const { error: createError } = await supabase.storage.createBucket(bucketName, {
      public: true,
      allowedMimeTypes: ["image/*"],
      fileSizeLimit: `${maxFileSizeBytes}`,
    });

    if (createError) {
      throw createError;
    }
  }

  hasEnsuredBucket = true;
}

type UploadOptions = {
  prefix?: string;
};

export async function uploadToImagesBucket(file: File, options: UploadOptions = {}): Promise<string> {
  await ensureImagesBucket();

  const supabase = getServiceSupabaseClient();
  const fileExtension = file.name.split(".").pop()?.toLowerCase() ?? "bin";
  const folder = options.prefix?.replace(/\/$/, "") ?? "uploads";
  const objectPath = `${folder}/${randomUUID()}.${fileExtension}`;

  const fileBuffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await supabase.storage
    .from(bucketName)
    .upload(objectPath, fileBuffer, {
      cacheControl: IMAGE_ASSET_CACHE_CONTROL_SECONDS,
      contentType: file.type || undefined,
      upsert: false,
    });

  if (uploadError) {
    throw uploadError;
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from(bucketName).getPublicUrl(objectPath);

  return publicUrl;
}
