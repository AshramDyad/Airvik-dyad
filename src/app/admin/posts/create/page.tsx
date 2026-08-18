import { getCategories } from "@/lib/api";
import { PostForm } from "@/components/admin/posts/post-form";
import { requirePageFeature } from "@/lib/server/page-auth";
import { getInternalLinkOptions } from "@/lib/server/posts";

export default async function CreatePostPage() {
  await requirePageFeature("postsCreate");
  const [categories, internalLinkOptions] = await Promise.all([
    getCategories(),
    getInternalLinkOptions(),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Add New Post</h1>
      <PostForm categories={categories} internalLinkOptions={internalLinkOptions} />
    </div>
  );
}
