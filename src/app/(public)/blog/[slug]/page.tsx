import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Image from "next/image";
import { format } from "date-fns";
import { getPostBySlug } from "@/lib/server/posts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { buildMetadata } from "@/lib/seo/metadata";
import { JsonLd } from "@/components/seo/json-ld";
import { blogPostingSchema } from "@/lib/seo/structured-data";

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

  return buildMetadata({
    title: post.title,
    description:
      post.excerpt ||
      `Read "${post.title}" — a story from Sahajanand Wellness ashram in Rishikesh.`,
    path: `/blog/${post.slug}`,
    image: post.featured_image || undefined,
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

  return (
    <article className="container mx-auto py-12 px-4 max-w-4xl">
      <JsonLd
        data={blogPostingSchema({
          title: post.title,
          description: post.excerpt || undefined,
          image: post.featured_image || undefined,
          datePublished: post.published_at,
          dateModified: post.updated_at,
          authorName: post.author?.full_name || undefined,
          url: `/blog/${post.slug}`,
        })}
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
            alt={post.title}
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
    </article>
  );
}
