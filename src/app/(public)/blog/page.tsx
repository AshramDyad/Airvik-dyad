import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { format } from "date-fns";
import { getPosts } from "@/lib/server/posts";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { buildMetadata } from "@/lib/seo/metadata";

export const dynamic = 'force-dynamic';

export const metadata: Metadata = buildMetadata({
  title: "News & Stories from the Ashram",
  description:
    "Updates, stories and spiritual insights from Sahajanand Wellness ashram on the banks of the Ganges in Rishikesh — yoga, festivals, Ganga Aarti and community seva.",
  path: "/blog",
});

export default async function BlogPage() {
  const posts = await getPosts({ status: "published" });

  return (
    <div className="container mx-auto py-12 px-4">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-serif font-bold mb-4">Latest Stories</h1>
        <p className="text-muted-foreground text-lg">Updates, news, and insights from our ashram.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {posts.length > 0 ? (
          posts.map((post) => (
            <Link href={`/blog/${post.slug}`} key={post.id} className="group">
              <Card className="h-full overflow-hidden transition-shadow hover:shadow-lg border-none shadow-md">
                <div className="relative aspect-video w-full overflow-hidden rounded-t-lg">
                  {post.featured_image ? (
                    <Image
                      src={post.featured_image}
                      alt={post.featured_image_alt || post.title}
                      fill
                      className="object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <div className="w-full h-full bg-muted flex items-center justify-center text-muted-foreground">
                      No Image
                    </div>
                  )}
                </div>
                <CardHeader>
                  <div className="flex gap-2 mb-2">
                    {post.categories?.slice(0, 2).map((cat) => (
                      <Badge key={cat.id} variant="secondary" className="text-xs">
                        {cat.name}
                      </Badge>
                    ))}
                  </div>
                  <CardTitle className="line-clamp-2 group-hover:text-primary transition-colors">
                    {post.title}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground line-clamp-3 text-sm">
                    {post.excerpt || "No excerpt available."}
                  </p>
                </CardContent>
                <CardFooter className="text-xs text-muted-foreground">
                  {post.published_at && format(new Date(post.published_at), "MMMM d, yyyy")}
                </CardFooter>
              </Card>
            </Link>
          ))
        ) : (
            <div className="col-span-full text-center py-12">
                <p className="text-lg text-muted-foreground">No posts available yet.</p>
            </div>
        )}
      </div>
    </div>
  );
}
