import { NextResponse } from "next/server";

import { createSessionClient } from "@/integrations/supabase/server";
import { getServerProfile } from "@/lib/server/page-auth";
import { uploadToImagesBucket } from "@/lib/server/storage";

const cacheHeaders = {
  "Cache-Control": "private, no-store",
};

const noStoreJson = (body: unknown, init?: ResponseInit) =>
  NextResponse.json(body, { ...init, headers: cacheHeaders });

export async function POST(request: Request) {
  const supabase = await createSessionClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return noStoreJson({ error: "Unauthorized" }, { status: 401 });
  }

  const profile = await getServerProfile();

  if (!profile) {
    return noStoreJson({ error: "Unauthorized" }, { status: 401 });
  }

  const hasSettingPermission = profile.permissions.includes("update:setting");

  if (!hasSettingPermission) {
    return noStoreJson({ error: "Forbidden" }, { status: 403 });
  }

  const formData = await request.formData();
  const rawFile = formData.get("file");

  if (!rawFile || !(rawFile instanceof File)) {
    return noStoreJson({ error: "Missing file" }, { status: 400 });
  }

  if (!rawFile.type?.startsWith("image/")) {
    return noStoreJson({ error: "Only image uploads are allowed" }, { status: 400 });
  }

  try {
    const url = await uploadToImagesBucket(rawFile, { prefix: "event-banners" });
    return noStoreJson({ url });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload failed";
    return noStoreJson({ error: message }, { status: 500 });
  }
}
