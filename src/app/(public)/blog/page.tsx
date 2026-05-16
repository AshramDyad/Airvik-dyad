import Image from "next/image";
import { format } from "date-fns";
import {
  getPublishedPosts,
} from "@/lib/server/posts";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

export const revalidate = 3600;

export default async function BlogPage() {
  const posts = await getPublishedPosts();

  return (
    <div className="container mx-auto py-12 px-4">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-serif font-bold mb-4">Latest Stories</h1>
        <p className="text-muted-foreground text-lg">Updates, news, and insights from our ashram.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {posts.length > 0 ? (
          posts.map((post) => (
            <a href={`/blog/${post.slug}`} key={post.id} className="group">
              <Card className="h-full overflow-hidden transition-shadow hover:shadow-lg border-none shadow-md">
                <div className="relative aspect-video w-full overflow-hidden rounded-t-lg">
                  {post.featured_image ? (
                    <Image
                      src={post.featured_image}
                      alt={post.title}
                      fill
                      className="object-cover transition-transform duration-300 group-hover:scale-105"
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
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
            </a>
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
