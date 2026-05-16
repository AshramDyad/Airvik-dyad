import { Post } from "@/data/types";
import { createClient } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";
import {
  DB_POST_WITH_CATEGORIES_SELECT_COLUMNS,
  DbPostWithCategories,
  fromDbPostWithCategories,
} from "@/lib/api/blog-mappers";
import { getServerSupabaseClient } from "@/lib/server/supabase";

export const PUBLIC_POSTS_CACHE_TAG = "public-posts";
export const PUBLIC_POSTS_REVALIDATE_SECONDS = 3600;

type PostSearchParams = {
  month?: string;
  categoryId?: string;
  search?: string;
  status?: "draft" | "published";
};

type ProfileRow = {
  id: string;
  name: string | null;
};

type PostCategoryRow = {
  post_id: string;
};

type ServerSupabaseClient = Awaited<ReturnType<typeof getServerSupabaseClient>>;
type PostsSupabaseClient = Pick<ServerSupabaseClient, "from">;

const createPublicReadClient = (): PostsSupabaseClient | null => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
};

const attachAuthors = async (
  supabase: PostsSupabaseClient,
  posts: Post[]
): Promise<Post[]> => {
  const uniqueAuthorIds = Array.from(
    new Set(posts.map((post) => post.author_id).filter((id) => id))
  );

  if (uniqueAuthorIds.length === 0) {
    return posts;
  }

  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("id, name")
    .in("id", uniqueAuthorIds);

  if (error) {
    throw error;
  }

  const profileRows = (profiles ?? []) as ProfileRow[];
  const profileMap = new Map<string, ProfileRow>(
    profileRows.map((profile) => [profile.id, profile])
  );

  return posts.map((post) => {
    const matchedProfile = profileMap.get(post.author_id ?? "");
    if (!matchedProfile) {
      return post;
    }

    return {
      ...post,
      author: {
        email: post.author?.email ?? "",
        full_name: matchedProfile.name ?? undefined,
      },
    };
  });
};

const getMonthRange = (month?: string) => {
  if (!month || !/\d{4}-\d{2}/.test(month)) {
    return null;
  }

  const [yearStr, monthStr] = month.split("-");
  const year = Number(yearStr);
  const monthIndex = Number(monthStr);
  if (Number.isNaN(year) || Number.isNaN(monthIndex)) {
    return null;
  }

  const startDate = `${year}-${String(monthIndex).padStart(2, "0")}-01`;
  const nextMonth = monthIndex === 12 ? 1 : monthIndex + 1;
  const nextYear = monthIndex === 12 ? year + 1 : year;
  const endDate = `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`;

  return { startDate, endDate };
};

const buildPostsQuery = (
  supabase: PostsSupabaseClient,
  searchParams?: PostSearchParams,
  selectOptions?: { head?: boolean; count?: "exact" | "planned" | "estimated" }
) => {
  let query = supabase
    .from("posts")
    .select(DB_POST_WITH_CATEGORIES_SELECT_COLUMNS, selectOptions)
    .order("created_at", { ascending: false });

  if (searchParams?.status) {
    query = query.eq("status", searchParams.status);
  }

  if (searchParams?.search) {
    query = query.ilike("title", `%${searchParams.search}%`);
  }

  const range = getMonthRange(searchParams?.month);
  if (range) {
    query = query.gte("created_at", range.startDate).lt("created_at", range.endDate);
  }

  return query;
};

const getPostIdsForCategory = async (
  supabase: PostsSupabaseClient,
  categoryId?: string
): Promise<string[] | null> => {
  if (!categoryId) {
    return null;
  }

  const { data, error } = await supabase
    .from("post_categories")
    .select("post_id")
    .eq("category_id", categoryId);

  if (error) {
    throw error;
  }

  const typedData = (data ?? []) as PostCategoryRow[];
  return typedData.map((pc) => pc.post_id);
};

export const getPosts = async (
  searchParams?: PostSearchParams
): Promise<Post[]> => {
  const supabase = await getServerSupabaseClient();
  let query = buildPostsQuery(supabase, searchParams);
  const postIds = await getPostIdsForCategory(supabase, searchParams?.categoryId);

  if (searchParams?.categoryId) {
    if (!postIds || postIds.length === 0) {
      return [];
    }

    query = query.in("id", postIds);
  }

  const { data, error } = await query;
  if (error) {
    throw error;
  }

  const typedPosts = (data ?? []) as unknown as DbPostWithCategories[];
  const mappedPosts = typedPosts.map(fromDbPostWithCategories);
  return attachAuthors(supabase, mappedPosts);
};

async function getPublishedPostsUncached(): Promise<Post[]> {
  const supabase = createPublicReadClient();
  if (!supabase) {
    return [];
  }

  const { data, error } = await buildPostsQuery(supabase, {
    status: "published",
  });

  if (error) {
    console.error("Error fetching public published posts", error);
    return [];
  }

  const typedPosts = (data ?? []) as unknown as DbPostWithCategories[];
  const mappedPosts = typedPosts.map(fromDbPostWithCategories);
  return attachAuthors(supabase, mappedPosts);
}

export const getPublishedPosts = unstable_cache(
  getPublishedPostsUncached,
  ["public-published-posts"],
  {
    revalidate: PUBLIC_POSTS_REVALIDATE_SECONDS,
    tags: [PUBLIC_POSTS_CACHE_TAG],
  }
);

export const getPostById = async (id: string): Promise<Post> => {
  const supabase = await getServerSupabaseClient();
  const { data, error } = await supabase
    .from("posts")
    .select(DB_POST_WITH_CATEGORIES_SELECT_COLUMNS)
    .eq("id", id)
    .single();

  if (error) {
    throw error;
  }

  const post = fromDbPostWithCategories(data as unknown as DbPostWithCategories);
  const [withAuthor] = await attachAuthors(supabase, [post]);
  return withAuthor ?? post;
};

export const getPostBySlug = async (slug: string): Promise<Post | null> => {
  const supabase = await getServerSupabaseClient();
  const { data, error } = await supabase
    .from("posts")
    .select(DB_POST_WITH_CATEGORIES_SELECT_COLUMNS)
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  const post = fromDbPostWithCategories(data as unknown as DbPostWithCategories);
  const [withAuthor] = await attachAuthors(supabase, [post]);
  return withAuthor ?? post;
};

async function getPublishedPostBySlugUncached(
  slug: string
): Promise<Post | null> {
  const supabase = createPublicReadClient();
  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from("posts")
    .select(DB_POST_WITH_CATEGORIES_SELECT_COLUMNS)
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();

  if (error) {
    console.error("Error fetching public post by slug", error);
    return null;
  }

  if (!data) {
    return null;
  }

  const post = fromDbPostWithCategories(data as unknown as DbPostWithCategories);
  const [withAuthor] = await attachAuthors(supabase, [post]);
  return withAuthor ?? post;
}

export const getPublishedPostBySlug = unstable_cache(
  getPublishedPostBySlugUncached,
  ["public-published-post-by-slug"],
  {
    revalidate: PUBLIC_POSTS_REVALIDATE_SECONDS,
    tags: [PUBLIC_POSTS_CACHE_TAG],
  }
);

export const countPosts = async (
  searchParams?: PostSearchParams
): Promise<number> => {
  const supabase = await getServerSupabaseClient();
  let query = buildPostsQuery(supabase, searchParams, {
    head: true,
    count: "exact",
  });
  const postIds = await getPostIdsForCategory(supabase, searchParams?.categoryId);

  if (searchParams?.categoryId) {
    if (!postIds || postIds.length === 0) {
      return 0;
    }

    query = query.in("id", postIds);
  }

  const { count, error } = await query;
  if (error) {
    throw error;
  }

  return count ?? 0;
};
