"use client";

import { useEffect, useMemo, useTransition } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

import type { Review } from "@/data/types";
import { createReview, updateReview } from "@/lib/server/reviews";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ImageUpload } from "@/components/shared/image-upload";

const formSchema = z.object({
  reviewerName: z.string().trim().min(1, "Name is required").max(150),
  reviewerTitle: z.string().trim().max(150, "Too long").optional(),
  content: z.string().trim().min(1, "Content is required").max(2000),
  imageUrl: z.string().trim().min(1, "Image is required"),
  isPublished: z.boolean(),
});

type FormValues = z.infer<typeof formSchema>;

interface ReviewFormProps {
  initialData?: Review | null;
}

export function ReviewForm({ initialData }: ReviewFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const defaultValues: FormValues = useMemo(
    () => ({
      reviewerName: initialData?.reviewerName ?? "",
      reviewerTitle: initialData?.reviewerTitle ?? "",
      content: initialData?.content ?? "",
      imageUrl: initialData?.imageUrl ?? "",
      isPublished: initialData?.isPublished ?? true,
    }),
    [initialData]
  );

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues,
  });

  useEffect(() => {
    form.reset(defaultValues);
  }, [defaultValues, form]);

  const onSubmit = (values: FormValues) => {
    startTransition(async () => {
      try {
        if (initialData?.id) {
          await updateReview(initialData.id, values);
          toast.success("Review updated");
        } else {
          await createReview(values);
          toast.success("Review created");
        }
        router.push("/admin/reviews");
      } catch (error) {
        console.error(error);
        toast.error("Unable to save review");
      }
    });
  };

  return (
    <Card className="max-w-3xl">
      <CardHeader>
        <CardTitle>{initialData ? "Edit Review" : "Add Review"}</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            <FormField
              control={form.control}
              name="imageUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Reviewer image</FormLabel>
                  <FormControl>
                    <ImageUpload category="reviews" value={field.value} onChange={field.onChange} />
                  </FormControl>
                  <FormDescription>Square photos work best.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid gap-6 md:grid-cols-2">
              <FormField
                control={form.control}
                name="reviewerName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Guest name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="reviewerTitle"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title or Context</FormLabel>
                    <FormControl>
                      <Input placeholder="Yoga retreat guest" {...field} />
                    </FormControl>
                    <FormDescription>Optional short descriptor.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="content"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Review</FormLabel>
                  <FormControl>
                    <Textarea className="min-h-[150px]" placeholder="Their experience..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="isPublished"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-4">
                  <div className="space-y-1">
                    <FormLabel>Publish immediately</FormLabel>
                    <FormDescription>
                      Toggle visibility on the public website.
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />

            <div className="flex gap-3">
              <Button type="submit" disabled={isPending}>
                {isPending ? "Saving..." : "Save"}
              </Button>
              <Button type="button" variant="outline" onClick={() => router.push("/admin/reviews")} disabled={isPending}>
                Cancel
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
