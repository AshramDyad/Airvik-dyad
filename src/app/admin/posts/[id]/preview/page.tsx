import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getPostById } from "@/lib/server/posts";
import { requirePageFeature } from "@/lib/server/page-auth";

export default async function AdminPostPreviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePageFeature("postsUpdate");
  const { id } = await params;
  let post: Awaited<ReturnType<typeof getPostById>>;

  try {
    post = await getPostById(id);
  } catch {
    notFound();
  }

  return (
    <article className="container mx-auto max-w-4xl space-y-8 px-4 py-12">
      <Button variant="ghost" asChild className="pl-0">
        <Link href={`/admin/posts/${post.id}`}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to editor
        </Link>
      </Button>
      <div className="rounded-lg border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
        Draft preview. This page is protected and is not included in public SEO output.
      </div>
      <header className="space-y-4">
        <p className="text-sm font-medium uppercase tracking-wide text-primary">{post.status}</p>
        <h1 className="text-4xl font-serif font-bold leading-tight">{post.title}</h1>
        {post.excerpt ? <p className="text-lg text-muted-foreground">{post.excerpt}</p> : null}
      </header>
      {post.featured_image ? (
        <div className="relative aspect-video overflow-hidden rounded-lg">
          <Image
            src={post.featured_image}
            alt={post.featured_image_alt || post.title}
            fill
            className="object-cover"
          />
        </div>
      ) : null}
      <div
        className="prose prose-lg dark:prose-invert max-w-none"
        dangerouslySetInnerHTML={{ __html: post.content || "" }}
      />
    </article>
  );
}
