import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Image from "next/image";
import { format } from "date-fns";
import { getPostBySlug } from "@/lib/server/posts";
import { getRelatedPosts } from "@/lib/server/posts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { buildMetadata, getPostSeoValues } from "@/lib/seo/metadata";
import { JsonLd } from "@/components/seo/json-ld";
import { blogPostingSchema } from "@/lib/seo/structured-data";
import { breadcrumbSchema } from "@/lib/seo/structured-data";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPostBySlug(slug);

  if (!post) {
    return buildMetadata({
      title: "Story Not Found",
      description: "This story could not be found.",
      path: `/blog/${slug}`,
      noindex: true,
    });
  }

  const seoValues = getPostSeoValues(post);
  return buildMetadata({
    title: seoValues.title,
    description: seoValues.description,
    path: `/blog/${post.slug}`,
    image: post.featured_image || undefined,
    keywords: post.target_keywords?.slice(0, 12),
    openGraphType: "article",
    publishedTime: post.published_at,
    modifiedTime: post.updated_at,
    authors: [post.author?.full_name || "Sahajanand Wellness"],
  });
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const resolvedParams = await params;
  const post = await getPostBySlug(resolvedParams.slug);

  if (!post) {
    notFound();
  }

  const relatedPosts = await getRelatedPosts(post);

  return (
    <article className="container mx-auto py-12 px-4 max-w-4xl">
      <JsonLd
        data={blogPostingSchema({
          title: post.title,
          description: getPostSeoValues(post).description,
          image: post.featured_image || undefined,
          datePublished: post.published_at,
          dateModified: post.updated_at,
          authorName: post.author?.full_name || undefined,
          section: post.categories?.[0]?.name,
          keywords: post.target_keywords,
          url: `/blog/${post.slug}`,
        })}
      />
      <JsonLd
        data={breadcrumbSchema([
          { name: "Home", path: "/" },
          { name: "Blog", path: "/blog" },
          { name: post.title, path: `/blog/${post.slug}` },
        ])}
      />
      <Button variant="ghost" asChild className="mb-8 pl-0 hover:bg-transparent hover:text-primary">
        <Link href="/blog">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Blog
        </Link>
      </Button>

      <div className="space-y-6 text-center mb-12">
        <div className="flex justify-center gap-2">
             {post.categories?.map((cat) => (
                <Badge key={cat.id} variant="outline">
                {cat.name}
                </Badge>
            ))}
        </div>
        <h1 className="text-4xl md:text-5xl font-serif font-bold leading-tight">{post.title}</h1>
        <div className="text-muted-foreground">
             {post.published_at && format(new Date(post.published_at), "MMMM d, yyyy")}
             {post.author?.full_name && ` • by ${post.author.full_name}`}
        </div>
      </div>

      {post.featured_image && (
        <div className="relative aspect-video w-full overflow-hidden rounded-lg mb-12 shadow-lg">
          <Image
            src={post.featured_image}
            alt={post.featured_image_alt || post.title}
            fill
            className="object-cover"
            priority
          />
        </div>
      )}

      <div 
        className="prose prose-lg dark:prose-invert max-w-none"
        dangerouslySetInnerHTML={{ __html: post.content || "" }}
      />

      {relatedPosts.length > 0 ? (
        <section className="mt-16 border-t pt-10" aria-labelledby="related-posts-heading">
          <h2 id="related-posts-heading" className="mb-6 text-2xl font-serif font-semibold">
            Related stories
          </h2>
          <div className="grid gap-4 md:grid-cols-3">
            {relatedPosts.map((relatedPost) => (
              <Link
                key={relatedPost.id}
                href={`/blog/${relatedPost.slug}`}
                className="rounded-lg border p-4 transition-colors hover:border-primary hover:bg-muted/40"
              >
                <span className="font-medium">{relatedPost.title}</span>
                {relatedPost.excerpt ? (
                  <span className="mt-2 block text-sm text-muted-foreground line-clamp-3">
                    {relatedPost.excerpt}
                  </span>
                ) : null}
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </article>
  );
}
