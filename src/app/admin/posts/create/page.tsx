import { getCategories } from "@/lib/api";
import { PostFormLoader } from "@/components/admin/posts/post-form-loader";
import { requirePageFeature } from "@/lib/server/page-auth";

export default async function CreatePostPage() {
  await requirePageFeature("postsCreate");
  const categories = await getCategories();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Add New Post</h1>
      <PostFormLoader categories={categories} />
    </div>
  );
}
