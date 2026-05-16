import { beforeEach, describe, expect, it, vi } from "vitest";

const getServerSupabaseClientMock = vi.hoisted(() => vi.fn());
const createClientMock = vi.hoisted(() => vi.fn());
const unstableCacheMock = vi.hoisted(() => vi.fn((fn) => fn));

vi.mock("@/lib/server/supabase", () => ({
  getServerSupabaseClient: getServerSupabaseClientMock,
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: createClientMock,
}));

vi.mock("next/cache", () => ({
  unstable_cache: unstableCacheMock,
}));

import {
  DB_POST_WITH_CATEGORIES_SELECT_COLUMNS,
} from "@/lib/api/blog-mappers";
import {
  countPosts,
  getPostBySlug,
  getPosts,
  getPublishedPostBySlug,
  getPublishedPosts,
  PUBLIC_POSTS_CACHE_TAG,
  PUBLIC_POSTS_REVALIDATE_SECONDS,
} from "./posts";

const postRow = {
  id: "post-1",
  title: "A Quiet Morning",
  slug: "quiet-morning",
  content: "<p>Hello</p>",
  excerpt: "Hello",
  featured_image: "https://example.com/post.jpg",
  status: "published",
  published_at: "2026-05-01T00:00:00.000Z",
  author_id: null,
  created_at: "2026-04-30T00:00:00.000Z",
  updated_at: "2026-05-01T00:00:00.000Z",
  categories: [],
};

const createQuery = (response: unknown) => {
  const query = {
    select: vi.fn(() => query),
    order: vi.fn(() => query),
    eq: vi.fn(() => query),
    ilike: vi.fn(() => query),
    gte: vi.fn(() => query),
    lt: vi.fn(() => query),
    in: vi.fn(() => query),
    single: vi.fn(async () => response),
    maybeSingle: vi.fn(async () => response),
    then: (resolve: (value: unknown) => unknown) => Promise.resolve(response).then(resolve),
  };
  return query;
};

describe("post server data access", () => {
  beforeEach(() => {
    getServerSupabaseClientMock.mockClear();
    createClientMock.mockClear();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://supabase.test";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
  });

  it("getPosts uses exact post and category columns", async () => {
    const query = createQuery({ data: [postRow], error: null });
    const supabase = { from: vi.fn(() => query) };
    getServerSupabaseClientMock.mockResolvedValue(supabase);

    await getPosts({ status: "published" });

    expect(supabase.from).toHaveBeenCalledWith("posts");
    expect(query.select).toHaveBeenCalledWith(
      DB_POST_WITH_CATEGORIES_SELECT_COLUMNS,
      undefined
    );
    expect(query.order).toHaveBeenCalledWith("created_at", {
      ascending: false,
    });
    expect(query.eq).toHaveBeenCalledWith("status", "published");
  });

  it("getPostBySlug uses exact post and category columns", async () => {
    const query = createQuery({ data: postRow, error: null });
    const supabase = { from: vi.fn(() => query) };
    getServerSupabaseClientMock.mockResolvedValue(supabase);

    await getPostBySlug("quiet-morning");

    expect(query.select).toHaveBeenCalledWith(
      DB_POST_WITH_CATEGORIES_SELECT_COLUMNS
    );
    expect(query.eq).toHaveBeenCalledWith("slug", "quiet-morning");
    expect(query.eq).toHaveBeenCalledWith("status", "published");
    expect(query.maybeSingle).toHaveBeenCalledTimes(1);
  });

  it("countPosts uses the same exact select with a head count", async () => {
    const query = createQuery({ count: 3, error: null });
    const supabase = { from: vi.fn(() => query) };
    getServerSupabaseClientMock.mockResolvedValue(supabase);

    await expect(countPosts({ status: "draft" })).resolves.toBe(3);

    expect(query.select).toHaveBeenCalledWith(
      DB_POST_WITH_CATEGORIES_SELECT_COLUMNS,
      { head: true, count: "exact" }
    );
    expect(query.eq).toHaveBeenCalledWith("status", "draft");
  });

  it("getPublishedPosts uses a cached cookie-free public client", async () => {
    const query = createQuery({ data: [postRow], error: null });
    const supabase = { from: vi.fn(() => query) };
    createClientMock.mockReturnValue(supabase);

    await getPublishedPosts();

    expect(createClientMock).toHaveBeenCalledWith(
      "https://supabase.test",
      "anon-key",
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );
    expect(getServerSupabaseClientMock).not.toHaveBeenCalled();
    expect(supabase.from).toHaveBeenCalledWith("posts");
    expect(query.select).toHaveBeenCalledWith(
      DB_POST_WITH_CATEGORIES_SELECT_COLUMNS,
      undefined
    );
    expect(query.eq).toHaveBeenCalledWith("status", "published");
    expect(PUBLIC_POSTS_CACHE_TAG).toBe("public-posts");
    expect(PUBLIC_POSTS_REVALIDATE_SECONDS).toBe(3600);
  });

  it("getPublishedPostBySlug uses the public cache and published status filter", async () => {
    const query = createQuery({ data: postRow, error: null });
    const supabase = { from: vi.fn(() => query) };
    createClientMock.mockReturnValue(supabase);

    await getPublishedPostBySlug("quiet-morning");

    expect(getServerSupabaseClientMock).not.toHaveBeenCalled();
    expect(query.select).toHaveBeenCalledWith(
      DB_POST_WITH_CATEGORIES_SELECT_COLUMNS
    );
    expect(query.eq).toHaveBeenCalledWith("slug", "quiet-morning");
    expect(query.eq).toHaveBeenCalledWith("status", "published");
    expect(query.maybeSingle).toHaveBeenCalledTimes(1);
    expect(PUBLIC_POSTS_CACHE_TAG).toBe("public-posts");
    expect(PUBLIC_POSTS_REVALIDATE_SECONDS).toBe(3600);
  });
});
