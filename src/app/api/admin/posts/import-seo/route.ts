import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import type { PostSourceQuery } from "@/data/types";
import { getServerProfile } from "@/lib/server/page-auth";
import { getServerSupabaseClient } from "@/lib/server/supabase";
import {
  SEO_MASTER_CATEGORY_SLUGS,
  type SeoDraftImportPayload,
} from "@/lib/seo/seo-draft-import";

type ExistingPostRow = {
  id: string;
  slug: string;
  status: "draft" | "published";
};

type CategoryRow = {
  id: string;
  slug: string;
};

const isSourceQuery = (value: unknown): value is PostSourceQuery => {
  if (typeof value !== "object" || value === null) return false;
  const source = value as Record<string, unknown>;
  return (
    typeof source.query === "string" &&
    (source.priority === "P1" || source.priority === "P2" || source.priority === "P3") &&
    typeof source.impressions === "number" &&
    typeof source.clicks === "number" &&
    typeof source.average_position === "number" &&
    typeof source.action === "string" &&
    typeof source.source_target_path === "string"
  );
};

const isImportPayload = (value: unknown): value is SeoDraftImportPayload[] => {
  if (!Array.isArray(value) || value.length !== 4) return false;
  return value.every((item) => {
    if (typeof item !== "object" || item === null) return false;
    const payload = item as Record<string, unknown>;
    return (
      typeof payload.title === "string" &&
      typeof payload.slug === "string" &&
      typeof payload.content === "string" &&
      typeof payload.excerpt === "string" &&
      typeof payload.seo_title === "string" &&
      typeof payload.meta_description === "string" &&
      typeof payload.focus_keyword === "string" &&
      Array.isArray(payload.target_keywords) &&
      payload.target_keywords.every((keyword) => typeof keyword === "string") &&
      typeof payload.featured_image_alt === "string" &&
      typeof payload.seo_notes === "string" &&
      typeof payload.category_slug === "string" &&
      Array.isArray(payload.source_query_data) &&
      payload.source_query_data.every(isSourceQuery)
    );
  });
};

export async function POST(request: Request) {
  const profile = await getServerProfile();
  if (!profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!profile.permissions.includes("create:post") && !profile.permissions.includes("update:post")) {
    return NextResponse.json({ error: "You do not have permission to import posts" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400 });
  }
  if (!isImportPayload(body)) {
    return NextResponse.json({ error: "Import payload must contain four valid drafts" }, { status: 400 });
  }

  const sourceQueryCount = body.reduce(
    (count, draft) => count + draft.source_query_data.length,
    0,
  );
  const categorySlugsAreApproved = body.every((draft) =>
    SEO_MASTER_CATEGORY_SLUGS.includes(draft.category_slug),
  );
  if (
    new Set(body.map((draft) => draft.category_slug)).size !== 4 ||
    sourceQueryCount !== 50 ||
    !categorySlugsAreApproved
  ) {
    return NextResponse.json(
      { error: "Import must contain four approved drafts with all 50 source queries" },
      { status: 400 },
    );
  }

  const supabase = await getServerSupabaseClient();
  const categorySlugs = body.map((draft) => draft.category_slug);
  const { data: categoryData, error: categoryError } = await supabase
    .from("categories")
    .select("id, slug")
    .in("slug", categorySlugs);

  if (categoryError) {
    return NextResponse.json({ error: categoryError.message }, { status: 500 });
  }

  const categories = (categoryData ?? []) as CategoryRow[];
  const categoryMap = new Map(categories.map((category) => [category.slug, category.id]));
  const missingCategory = body.find((draft) => !categoryMap.has(draft.category_slug));
  if (missingCategory) {
    return NextResponse.json({ error: `Missing category: ${missingCategory.category_slug}` }, { status: 400 });
  }

  const slugs = body.map((draft) => draft.slug);
  const { data: existingData, error: existingError } = await supabase
    .from("posts")
    .select("id, slug, status")
    .in("slug", slugs);
  if (existingError) {
    return NextResponse.json({ error: existingError.message }, { status: 500 });
  }

  const existingMap = new Map(
    ((existingData ?? []) as ExistingPostRow[]).map((post) => [post.slug, post]),
  );
  const result: Array<{ slug: string; action: "created" | "updated" | "skipped" }> = [];

  for (const draft of body) {
    const existing = existingMap.get(draft.slug);
    if (existing?.status === "published") {
      result.push({ slug: draft.slug, action: "skipped" });
      continue;
    }

    const values = {
      title: draft.title,
      slug: draft.slug,
      content: draft.content,
      excerpt: draft.excerpt,
      status: "draft" as const,
      published_at: null,
      author_id: profile.userId,
      seo_title: draft.seo_title,
      meta_description: draft.meta_description,
      focus_keyword: draft.focus_keyword,
      target_keywords: draft.target_keywords,
      featured_image_alt: draft.featured_image_alt,
      seo_notes: draft.seo_notes,
      source_query_data: draft.source_query_data,
    };

    let postId = existing?.id;
    if (existing) {
      const { error } = await supabase.from("posts").update(values).eq("id", existing.id);
      if (error) {
        return NextResponse.json({ error: error.message, slug: draft.slug }, { status: 500 });
      }
    } else {
      const { data, error } = await supabase.from("posts").insert(values).select("id").single();
      if (error || !data) {
        return NextResponse.json({ error: error?.message ?? "Post was not created", slug: draft.slug }, { status: 500 });
      }
      postId = data.id as string;
    }

    const categoryId = categoryMap.get(draft.category_slug);
    if (!postId || !categoryId) {
      return NextResponse.json({ error: `Could not connect category for ${draft.slug}` }, { status: 500 });
    }
    const { error: deleteError } = await supabase.from("post_categories").delete().eq("post_id", postId);
    if (deleteError) {
      return NextResponse.json({ error: deleteError.message, slug: draft.slug }, { status: 500 });
    }
    const { error: categoryInsertError } = await supabase
      .from("post_categories")
      .insert({ post_id: postId, category_id: categoryId });
    if (categoryInsertError) {
      return NextResponse.json({ error: categoryInsertError.message, slug: draft.slug }, { status: 500 });
    }

    result.push({ slug: draft.slug, action: existing ? "updated" : "created" });
  }

  revalidatePath("/admin/posts");
  return NextResponse.json({ imported: result });
}
