import mediaManifest from "@/config/cloudflare-media-manifest.json";
import { SITE_URL } from "@/config/site";

type MediaManifest = Record<string, string>;

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function encodeObjectKey(key: string): string {
  return key
    .split("/")
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

export function isCloudflareR2Enabled(): boolean {
  return process.env.NEXT_PUBLIC_CLOUDFLARE_R2_ENABLED === "true";
}

export function publicMediaUrl(path: string): string {
  if (!path.startsWith("/")) {
    return path;
  }

  if (!isCloudflareR2Enabled()) {
    return path;
  }

  const objectKey = (mediaManifest as MediaManifest)[path];
  const publicBaseUrl = process.env.NEXT_PUBLIC_CLOUDFLARE_R2_PUBLIC_URL;

  if (!objectKey || !publicBaseUrl) {
    return path;
  }

  return `${trimTrailingSlash(publicBaseUrl)}/${encodeObjectKey(objectKey)}`;
}

export function absoluteMediaUrl(source: string): string {
  const resolvedSource = publicMediaUrl(source);
  return resolvedSource.startsWith("http")
    ? resolvedSource
    : new URL(resolvedSource, SITE_URL).toString();
}
