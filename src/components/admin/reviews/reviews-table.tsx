"use client";

import Image from "@/components/ui/cloudflare-image";
import Link from "next/link";
import { Pencil, Trash } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";

import type { Review } from "@/data/types";
import { deleteReview, toggleReviewPublish } from "@/lib/server/reviews";
import { cn } from "@/lib/utils";
import { useAuthContext } from "@/context/auth-context";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";

interface ReviewsTableProps {
  reviews: Review[];
}

export function ReviewsTable({ reviews }: ReviewsTableProps) {
  const [isPending, startTransition] = useTransition();
  const { hasPermission } = useAuthContext();
  const canUpdate = hasPermission("update:review");
  const canDelete = hasPermission("delete:review");

  const handleDelete = (id: string) => {
    if (!canDelete) {
      return;
    }
    if (!confirm("Delete this review? This action cannot be undone.")) {
      return;
    }

    startTransition(async () => {
      try {
        await deleteReview(id);
        toast.success("Review deleted");
      } catch (error) {
        console.error(error);
        toast.error("Failed to delete review");
      }
    });
  };

  const handleToggle = (id: string, nextValue: boolean) => {
    if (!canUpdate) {
      return;
    }
    startTransition(async () => {
      try {
        await toggleReviewPublish(id, nextValue);
        toast.success(nextValue ? "Review published" : "Review unpublished");
      } catch (error) {
        console.error(error);
        toast.error("Failed to update review");
      }
    });
  };

  return (
    <div className="rounded-md border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[100px]">Image</TableHead>
            <TableHead className="w-[220px]">Reviewer</TableHead>
            <TableHead>Content</TableHead>
            <TableHead className="w-[160px]">Published</TableHead>
            <TableHead className="text-right w-[140px]">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {reviews.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="h-24 text-center">
                No reviews yet.
              </TableCell>
            </TableRow>
          ) : (
            reviews.map((review) => (
              <TableRow key={review.id}>
                <TableCell>
                  <div className="relative h-14 w-14 overflow-hidden rounded-full border bg-muted">
                    {review.imageUrl ? (
                      <Image
                        src={review.imageUrl}
                        alt={`${review.reviewerName} avatar`}
                        fill
                        className="object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-[10px] text-muted-foreground">
                        No image
                      </div>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-col">
                    <span className="font-semibold">{review.reviewerName}</span>
                    {review.reviewerTitle && (
                      <span className="text-sm text-muted-foreground">{review.reviewerTitle}</span>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <p className="line-clamp-2 text-sm text-muted-foreground">
                    {review.content}
                  </p>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={review.isPublished}
                      onCheckedChange={(value) => handleToggle(review.id, value)}
                      disabled={isPending || !canUpdate}
                    />
                    <span
                      className={cn(
                        "text-sm",
                        review.isPublished ? "text-primary font-medium" : "text-muted-foreground"
                      )}
                    >
                      {review.isPublished ? "Visible" : "Hidden"}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    {canUpdate && (
                      <Button variant="ghost" size="icon" asChild>
                        <Link href={`/admin/reviews/${review.id}`}>
                          <Pencil className="h-4 w-4" />
                          <span className="sr-only">Edit</span>
                        </Link>
                      </Button>
                    )}
                    {canDelete && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(review.id)}
                        disabled={isPending}
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <Trash className="h-4 w-4" />
                        <span className="sr-only">Delete</span>
                      </Button>
                    )}
                    {!canUpdate && !canDelete && (
                      <span className="text-xs text-muted-foreground">No actions</span>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
