"use client";

import { useEffect, useMemo, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import Image from "@/components/ui/cloudflare-image";
import { useRouter } from "next/navigation";

import type { EventBanner } from "@/data/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { ImageUpload } from "@/components/shared/image-upload";
import { createEvent, updateEvent } from "@/lib/server/events";

const formSchema = z
  .object({
    title: z.string().trim().min(1, "Title is required").max(200),
    description: z.string().trim().max(500).optional(),
    imageUrl: z.string().trim().min(1, "Image is required"),
    isActive: z.boolean(),
    startsAt: z.string().optional(),
    endsAt: z.string().optional(),
  })
  .refine(
    (values) => {
      if (!values.startsAt || !values.endsAt) return true;
      return new Date(values.startsAt) <= new Date(values.endsAt);
    },
    { path: ["startsAt"], message: "Start date must be before end date" }
  );

type EventFormValues = z.infer<typeof formSchema>;

const toLocalInputValue = (iso?: string) => {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
};

const toIsoOrUndefined = (value?: string) => {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
};

type Props = {
  initialData?: EventBanner | null;
};

export function EventForm({ initialData }: Props) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const defaultValues: EventFormValues = useMemo(
    () => ({
      title: initialData?.title ?? "",
      description: initialData?.description ?? "",
      imageUrl: initialData?.imageUrl ?? "",
      isActive: initialData?.isActive ?? false,
      startsAt: toLocalInputValue(initialData?.startsAt),
      endsAt: toLocalInputValue(initialData?.endsAt),
    }),
    [initialData]
  );

  const form = useForm<EventFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues,
  });

  useEffect(() => {
    form.reset(defaultValues);
  }, [defaultValues, form]);

  const onSubmit = (values: EventFormValues) => {
    startTransition(async () => {
      try {
        const payload = {
          ...values,
          description: values.description?.trim() || undefined,
          startsAt: toIsoOrUndefined(values.startsAt),
          endsAt: toIsoOrUndefined(values.endsAt),
        };

        if (initialData?.id) {
          await updateEvent(initialData.id, payload);
          toast.success("Event updated");
        } else {
          await createEvent(payload);
          toast.success("Event created");
        }
        router.push("/admin/events");
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to save event";
        toast.error(message);
      }
    });
  };

  return (
    <Card className="max-w-4xl">
      <CardHeader>
        <CardTitle>{initialData ? "Edit Event" : "Create Event"}</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form className="space-y-8" onSubmit={form.handleSubmit(onSubmit)}>
            <FormField
              control={form.control}
              name="imageUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Banner image</FormLabel>
                  <FormControl>
                    <ImageUpload category="events" value={field.value} onChange={field.onChange} />
                  </FormControl>
                  <FormDescription>Use a landscape image for best results.</FormDescription>
                  <FormMessage />
                  {field.value && (
                    <div className="mt-4 overflow-hidden rounded-xl border">
                      <Image
                        src={field.value}
                        alt="Banner preview"
                        width={900}
                        height={500}
                        className="h-48 w-full object-cover"
                      />
                    </div>
                  )}
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title</FormLabel>
                    <FormControl>
                      <Input placeholder="Event title" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-4">
                    <div className="space-y-1">
                      <FormLabel>Enable Banner</FormLabel>
                      <FormDescription>
                        Set as the <strong>active</strong> homepage banner.
                        <br />
                        <span className="text-xs text-muted-foreground">
                          (Will disable any other active banner)
                        </span>
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Short description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Add a concise invitation or key details"
                      className="min-h-[120px]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <FormField
                control={form.control}
                name="startsAt"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Start Date</FormLabel>
                    <FormControl>
                      <Input type="datetime-local" {...field} />
                    </FormControl>
                    <FormDescription>Optional start date/time.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="endsAt"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>End Date</FormLabel>
                    <FormControl>
                      <Input type="datetime-local" {...field} />
                    </FormControl>
                    <FormDescription>Optional end date/time.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="flex gap-3">
              <Button type="submit" disabled={isPending}>
                {isPending ? "Saving..." : "Save Event"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push("/admin/events")}
                disabled={isPending}
              >
                Cancel
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
