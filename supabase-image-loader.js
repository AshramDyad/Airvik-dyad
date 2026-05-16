const SUPABASE_PUBLIC_OBJECT_SEGMENT = "/storage/v1/object/public/";
const SUPABASE_RENDER_IMAGE_SEGMENT = "/storage/v1/render/image/public/";

function isSupabaseStorageHost(hostname) {
  return hostname === "localhost" || hostname.endsWith(".supabase.co");
}

/**
 * @param {{ src: string; width: number; quality?: number }} props
 */
export default function supabaseImageLoader({ src, width, quality }) {
  if (!src.startsWith("http://") && !src.startsWith("https://")) {
    return src;
  }

  let url;

  try {
    url = new URL(src);
  } catch {
    return src;
  }

  if (!isSupabaseStorageHost(url.hostname)) {
    return src;
  }

  if (!url.pathname.includes(SUPABASE_PUBLIC_OBJECT_SEGMENT)) {
    return src;
  }

  url.pathname = url.pathname.replace(
    SUPABASE_PUBLIC_OBJECT_SEGMENT,
    SUPABASE_RENDER_IMAGE_SEGMENT,
  );
  url.searchParams.set("width", String(width));
  url.searchParams.set("quality", String(quality ?? 75));

  return url.toString();
}
