import { NextResponse } from "next/server";

import { createSessionClient } from "@/integrations/supabase/server";
import { getServerProfile } from "@/lib/server/page-auth";
import { uploadImageToR2 } from "@/lib/server/r2-storage";
import {
  isAllowedImageMimeType,
  isUploadCategory,
  MAX_ADMIN_IMAGE_BYTES,
} from "@/lib/uploads";

const unauthorized = NextResponse.json({ error: "Unauthorized" }, { status: 401 });

export async function POST(request: Request) {
  const supabase = await createSessionClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return unauthorized;
  }

  const profile = await getServerProfile();

  if (!profile) {
    return unauthorized;
  }

  const hasSettingPermission = profile.permissions.includes("update:setting");

  if (!hasSettingPermission) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const formData = await request.formData();
  const rawFile = formData.get("file");
  const rawCategory = formData.get("category");

  if (!rawFile || !(rawFile instanceof File)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }

  if (!isUploadCategory(rawCategory)) {
    return NextResponse.json({ error: "Invalid upload category" }, { status: 400 });
  }

  if (!isAllowedImageMimeType(rawFile.type)) {
    return NextResponse.json(
      { error: "Only JPEG, PNG, WebP, and GIF uploads are allowed" },
      { status: 400 },
    );
  }

  if (rawFile.size > MAX_ADMIN_IMAGE_BYTES) {
    return NextResponse.json({ error: "Image must be 5 MB or smaller" }, { status: 413 });
  }

  try {
    const url = await uploadImageToR2(rawFile, rawCategory);
    return NextResponse.json({ url });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
