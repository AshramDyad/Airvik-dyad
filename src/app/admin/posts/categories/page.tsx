import { getCategories } from "@/lib/api";
import { CategoriesManagerLoader } from "@/components/admin/posts/categories-manager-loader";
import { requirePageFeature } from "@/lib/server/page-auth";

export default async function CategoriesPage() {
  await requirePageFeature("postsUpdate");
  const categories = await getCategories();
  return <CategoriesManagerLoader initialCategories={categories} />;
}
