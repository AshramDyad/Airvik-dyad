import { Category, Post } from "@/data/types";

export const DB_CATEGORY_SELECT_COLUMNS =
  "id, name, slug, description, parent_id, created_at" as const;

export const DB_POST_SELECT_COLUMNS =
  "id, title, slug, content, excerpt, featured_image, status, published_at, author_id, created_at, updated_at" as const;

export const DB_POST_WITH_CATEGORIES_SELECT_COLUMNS =
  `${DB_POST_SELECT_COLUMNS}, categories:post_categories(categories(${DB_CATEGORY_SELECT_COLUMNS}))` as const;

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
