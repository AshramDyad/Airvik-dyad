import type { MetadataRoute } from "next";
import { SITE_URL, STATIC_PUBLIC_ROUTES } from "@/config/site";
import { getPosts } from "@/lib/server/posts";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticEntries: MetadataRoute.Sitemap = STATIC_PUBLIC_ROUTES.map(
    (route) => ({
      url: `${SITE_URL}${route.path === "/" ? "" : route.path}`,
      lastModified: now,
      changeFrequency: route.changeFrequency,
      priority: route.priority,
    }),
  );

  // Dynamic blog posts (defensive: never let a DB hiccup break the sitemap).
  let blogEntries: MetadataRoute.Sitemap = [];
  try {
    const posts = await getPosts({ status: "published" });
    blogEntries = posts
      .filter((post) => Boolean(post.slug))
      .map((post) => ({
        url: `${SITE_URL}/blog/${post.slug}`,
        lastModified: post.updated_at
          ? new Date(post.updated_at)
          : post.published_at
            ? new Date(post.published_at)
            : now,
        changeFrequency: "monthly" as const,
        priority: 0.5,
      }));
  } catch {
    blogEntries = [];
  }

  return [...staticEntries, ...blogEntries];
}
