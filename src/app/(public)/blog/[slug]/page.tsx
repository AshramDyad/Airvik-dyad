import { notFound } from "next/navigation";
import Image from "next/image";
import { format } from "date-fns";
import {
  getPublishedPostBySlug,
  getPublishedPosts,
} from "@/lib/server/posts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export const revalidate = 3600;

export async function generateStaticParams() {
  const posts = await getPublishedPosts();
  return posts.map((post) => ({ slug: post.slug }));
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const resolvedParams = await params;
  const post = await getPublishedPostBySlug(resolvedParams.slug);

  if (!post) {
    notFound();
  }

  return (
    <article className="container mx-auto py-12 px-4 max-w-4xl">
      <Button variant="ghost" asChild className="mb-8 pl-0 hover:bg-transparent hover:text-primary">
        <a href="/blog">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Blog
        </a>
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
            sizes="(max-width: 896px) 100vw, 896px"
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
