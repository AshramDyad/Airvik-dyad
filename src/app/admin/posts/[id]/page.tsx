import { getCategories } from "@/lib/api";
import { getInternalLinkOptions, getPostById } from "@/lib/server/posts";
import { PostForm } from "@/components/admin/posts/post-form";
import { requirePageFeature } from "@/lib/server/page-auth";

export default async function EditPostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePageFeature("postsUpdate");
  const resolvedParams = await params;
  const post = await getPostById(resolvedParams.id);
  const [categories, internalLinkOptions] = await Promise.all([
    getCategories(),
    getInternalLinkOptions(post.id),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Edit Post</h1>
      <PostForm post={post} categories={categories} internalLinkOptions={internalLinkOptions} />
    </div>
  );
}
