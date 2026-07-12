import { createSessionClient } from "@/integrations/supabase/server";
import { getServerProfile } from "@/lib/server/page-auth";
import { NextResponse } from "next/server";
import { z } from "zod";

const eventSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  imageUrl: z.string().min(1),
  isActive: z.boolean(),
  startsAt: z.string().optional(),
  endsAt: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    // 1. Create a cookie-aware Supabase client
    const supabase = await createSessionClient();
    
    // 2. Check authentication (this is critical for RLS and updated_by)
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: "Access denied: Unauthenticated user" },
        { status: 401 }
      );
    }

    // 2b. Explicit permission gate (defense-in-depth beyond RLS). Event banners
    // are a settings-level surface, matching the admin/uploads route. Finding M4.
    const profile = await getServerProfile();
    if (!profile || !profile.permissions.includes("update:setting")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // 3. Parse and validate request body
    const body = await request.json();
    const formData = eventSchema.parse(body);

    // 4. Prepare database payload
    const dbPayload = {
      title: formData.title,
      description: formData.description || null,
      image_url: formData.imageUrl,
      is_active: false, // Default to false, toggle later via RPC
      starts_at: formData.startsAt || null,
      ends_at: formData.endsAt || null,
      updated_by: user.id,
    };

    // 5. Insert into Supabase (will trigger RLS policies)
    const { data, error } = await supabase
      .from("event_banners")
      .insert(dbPayload)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // 6. Handle active status toggle if requested (using RPC)
    if (formData.isActive && data) {
      const { error: rpcError } = await supabase.rpc("toggle_event_banner", {
        target_event_id: data.id,
        new_status: true,
      });

      if (rpcError) {
         console.error("Failed to toggle banner:", rpcError);
         // We don't fail the whole request, but you could return a warning
      }
    }

    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal Server Error" },
      { status: 500 }
    );
  }
}
