import { Category, Post, PostSourceQuery } from "@/data/types";

export type DbCategory = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  parent_id: string | null;
  created_at: string;
};

export type DbPost = {
  id: string;
  title: string;
  slug: string;
  content: string | null;
  excerpt: string | null;
  featured_image: string | null;
  status: "draft" | "published";
  published_at: string | null;
  author_id: string | null;
  created_at: string;
  updated_at: string;
  seo_title: string | null;
  meta_description: string | null;
  focus_keyword: string | null;
  target_keywords: string[] | null;
  featured_image_alt: string | null;
  seo_notes: string | null;
  source_query_data: PostSourceQuery[] | null;
};

export type DbPostCategory = {
  categories: DbCategory;
};

export type DbPostWithCategories = DbPost & {
  categories?: DbPostCategory[];
};

export type DbPostUpdatePayload = Partial<
  Pick<
    DbPost,
    | "title"
    | "slug"
    | "content"
    | "excerpt"
    | "featured_image"
    | "status"
    | "published_at"
    | "updated_at"
    | "seo_title"
    | "meta_description"
    | "focus_keyword"
    | "target_keywords"
    | "featured_image_alt"
    | "seo_notes"
    | "source_query_data"
  >
>;

export const fromDbCategory = (dbCategory: DbCategory): Category => ({
  id: dbCategory.id,
  name: dbCategory.name,
  slug: dbCategory.slug,
  description: dbCategory.description ?? undefined,
  parent_id: dbCategory.parent_id ?? undefined,
  created_at: dbCategory.created_at,
});

export const fromDbPost = (dbPost: DbPost): Post => ({
  id: dbPost.id,
  title: dbPost.title,
  slug: dbPost.slug,
  content: dbPost.content ?? undefined,
  excerpt: dbPost.excerpt ?? undefined,
  featured_image: dbPost.featured_image ?? undefined,
  status: dbPost.status,
  published_at: dbPost.published_at ?? undefined,
  author_id: dbPost.author_id ?? "",
  created_at: dbPost.created_at,
  updated_at: dbPost.updated_at,
  seo_title: dbPost.seo_title ?? undefined,
  meta_description: dbPost.meta_description ?? undefined,
  focus_keyword: dbPost.focus_keyword ?? undefined,
  target_keywords: dbPost.target_keywords ?? undefined,
  featured_image_alt: dbPost.featured_image_alt ?? undefined,
  seo_notes: dbPost.seo_notes ?? undefined,
  source_query_data: dbPost.source_query_data ?? undefined,
});

export const fromDbPostWithCategories = (
  dbPost: DbPostWithCategories
): Post => {
  const mapped = fromDbPost(dbPost);
  if (dbPost.categories) {
    mapped.categories = dbPost.categories
      .map((pc) => pc.categories)
      .filter(Boolean)
      .map(fromDbCategory);
  }
  return mapped;
};
