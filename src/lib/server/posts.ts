import { Post } from "@/data/types";
import {
  DbPostWithCategories,
  fromDbPostWithCategories,
} from "@/lib/api/blog-mappers";
import { getServerSupabaseClient } from "@/lib/server/supabase";
import {
  type InternalLinkOption,
  STATIC_INTERNAL_LINKS,
} from "@/lib/seo/internal-links";

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

const attachAuthors = async (
  supabase: ServerSupabaseClient,
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
  supabase: ServerSupabaseClient,
  searchParams?: PostSearchParams,
  selectOptions?: { head?: boolean; count?: "exact" | "planned" | "estimated" }
) => {
  let query = supabase
    .from("posts")
    .select("*, categories:post_categories(categories(*))", selectOptions)
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
  supabase: ServerSupabaseClient,
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

  const typedPosts = (data ?? []) as DbPostWithCategories[];
  const mappedPosts = typedPosts.map(fromDbPostWithCategories);
  return attachAuthors(supabase, mappedPosts);
};

export const getPostById = async (id: string): Promise<Post> => {
  const supabase = await getServerSupabaseClient();
  const { data, error } = await supabase
    .from("posts")
    .select("*, categories:post_categories(categories(*))")
    .eq("id", id)
    .single();

  if (error) {
    throw error;
  }

  const post = fromDbPostWithCategories(data as DbPostWithCategories);
  const [withAuthor] = await attachAuthors(supabase, [post]);
  return withAuthor ?? post;
};

export const getPostBySlug = async (slug: string): Promise<Post | null> => {
  const supabase = await getServerSupabaseClient();
  const { data, error } = await supabase
    .from("posts")
    .select("*, categories:post_categories(categories(*))")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  const post = fromDbPostWithCategories(data as DbPostWithCategories);
  const [withAuthor] = await attachAuthors(supabase, [post]);
  return withAuthor ?? post;
};

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

export const getInternalLinkOptions = async (
  excludePostId?: string,
): Promise<InternalLinkOption[]> => {
  const publishedPosts = await getPosts({ status: "published" });
  const postOptions = publishedPosts
    .filter((post) => post.id !== excludePostId)
    .map((post) => ({
      label: post.title,
      href: `/blog/${post.slug}`,
      type: "post" as const,
    }));

  return [...STATIC_INTERNAL_LINKS, ...postOptions];
};

export const getRelatedPosts = async (
  post: Post,
  limit = 3,
): Promise<Post[]> => {
  const posts = await getPosts({ status: "published" });
  const categoryIds = new Set((post.categories ?? []).map((category) => category.id));

  return posts
    .filter((candidate) => candidate.id !== post.id)
    .map((candidate) => ({
      candidate,
      sharedCategories: (candidate.categories ?? []).filter((category) =>
        categoryIds.has(category.id),
      ).length,
    }))
    .sort((left, right) => {
      if (right.sharedCategories !== left.sharedCategories) {
        return right.sharedCategories - left.sharedCategories;
      }
      return right.candidate.updated_at.localeCompare(left.candidate.updated_at);
    })
    .slice(0, limit)
    .map(({ candidate }) => candidate);
};
