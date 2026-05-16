import { Plus } from "lucide-react";

import { requirePageFeature } from "@/lib/server/page-auth";
import { getAllReviews } from "@/lib/server/reviews";
import { Button } from "@/components/ui/button";
import { ReviewsTableLoader } from "@/components/admin/reviews/reviews-table-loader";

export default async function ReviewsPage() {
  const profile = await requirePageFeature("reviews");
  const reviews = await getAllReviews();
  const canCreate = profile.permissions.includes("create:review");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Reviews</h1>
          <p className="text-muted-foreground">Showcase guest stories on the public site.</p>
        </div>
        {canCreate && (
          <Button asChild>
            <a href="/admin/reviews/create">
              <Plus className="mr-2 h-4 w-4" />
              Add Review
            </a>
          </Button>
        )}
      </div>

      <ReviewsTableLoader reviews={reviews} />
    </div>
  );
}
