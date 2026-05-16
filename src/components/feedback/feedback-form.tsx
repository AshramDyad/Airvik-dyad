"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Star } from "lucide-react";
import { z } from "zod";

import {
  FEEDBACK_TYPE_OPTIONS,
  MAX_FEEDBACK_LENGTH,
  ROOM_OR_FACILITY_OPTIONS,
} from "@/constants/feedback";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

const feedbackTypeValues = [
  "suggestion",
  "praise",
  "complaint",
  "question",
] as const;

const ROOM_CLEAR_VALUE = "__none";

const FeedbackFormSchema = z.object({
  feedbackType: z.enum(feedbackTypeValues),
  message: z
    .string()
    .trim()
    .min(1, "Please share your feedback")
    .max(MAX_FEEDBACK_LENGTH, `Feedback must be ${MAX_FEEDBACK_LENGTH} characters or fewer`),
  name: z
    .string()
    .trim()
    .max(120, "Name must be 120 characters or fewer")
    .optional(),
  submitAsAnonymous: z.boolean(),
  email: z
    .string()
    .trim()
    .email("Please provide a valid email address")
    .max(254)
    .optional()
    .or(z.literal("")),
  roomOrFacility: z.enum(ROOM_OR_FACILITY_OPTIONS).optional(),
  rating: z.union([z.coerce.number().int().min(1).max(5), z.literal("")]).optional(),
});

type FeedbackFormValues = z.infer<typeof FeedbackFormSchema>;

export function FeedbackForm() {
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [successMessage, setSuccessMessage] = React.useState<string | null>(null);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  const form = useForm<FeedbackFormValues>({
    resolver: zodResolver(FeedbackFormSchema),
    defaultValues: {
      feedbackType: FEEDBACK_TYPE_OPTIONS[0].value,
      message: "",
      name: "",
      submitAsAnonymous: false,
      email: "",
      roomOrFacility: undefined,
      rating: "",
    },
  });

  const messageValue = form.watch("message");
  const submitAsAnonymous = form.watch("submitAsAnonymous");

  const onSubmit = async (values: FeedbackFormValues) => {
    setIsSubmitting(true);
    setSuccessMessage(null);
    setErrorMessage(null);

    const payload = {
      feedbackType: values.feedbackType,
      message: values.message.trim(),
      name: values.submitAsAnonymous ? undefined : values.name?.trim() || undefined,
      submitAsAnonymous: Boolean(values.submitAsAnonymous),
      email: values.email ? values.email.trim() : undefined,
      roomOrFacility: values.roomOrFacility ? values.roomOrFacility : undefined,
      rating:
        typeof values.rating === "number"
          ? values.rating
          : values.rating
          ? Number(values.rating)
          : undefined,
    };

    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify(payload),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result?.message ?? "Unable to submit feedback");
      }

      setSuccessMessage(result?.message ?? "Thank you for your feedback! We appreciate your time.");
      setErrorMessage(null);
      form.reset();
    } catch (error) {
      console.error("Feedback submission failed", error);
      setErrorMessage(
        error instanceof Error ? error.message : "Something went wrong while submitting your feedback."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-3xl rounded-3xl border border-border/20 bg-card/40 p-6 shadow-md">
      <div className="space-y-4">
        {successMessage && (
          <Alert>
            <AlertDescription>{successMessage}</AlertDescription>
          </Alert>
        )}
        {errorMessage && (
          <Alert variant="destructive">
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        )}
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="mt-6 space-y-6">
          <FormField
            control={form.control}
            name="feedbackType"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Feedback type</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger className="h-12 rounded-2xl">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {FEEDBACK_TYPE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="message"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Your message</FormLabel>
                <FormControl>
                  <div>
                    <Textarea
                      {...field}
                      className="min-h-[160px] rounded-2xl"
                      maxLength={MAX_FEEDBACK_LENGTH}
                      placeholder="Share your suggestion, praise, complaint, or question"
                    />
                    <p className="mt-1 text-right text-xs text-muted-foreground">
                      {messageValue?.length ?? 0}/{MAX_FEEDBACK_LENGTH}
                    </p>
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid gap-6 md:grid-cols-2">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      disabled={submitAsAnonymous}
                      placeholder="e.g. Raju Sharma"
                      className="h-12 rounded-2xl"
                    />
                  </FormControl>
                  <FormDescription>Leave blank if you prefer to stay anonymous.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email (optional)</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="email"
                      className="h-12 rounded-2xl"
                      inputMode="email"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="roomOrFacility"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Room or facility (optional)</FormLabel>
                <Select
                  onValueChange={(value) =>
                    field.onChange(value === ROOM_CLEAR_VALUE ? undefined : value)
                  }
                  value={field.value ?? undefined}
                >
                  <FormControl>
                    <SelectTrigger className="h-12 rounded-2xl">
                      <SelectValue placeholder="Select an area" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value={ROOM_CLEAR_VALUE}>Not specified</SelectItem>
                    {ROOM_OR_FACILITY_OPTIONS.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="rating"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Rating (optional)</FormLabel>
                <FormDescription>How would you rate your recent experience?</FormDescription>
                <FormControl>
                  <RadioGroup
                    className="flex flex-wrap gap-3"
                    value={field.value?.toString() ?? ""}
                    onValueChange={(value) => field.onChange(value ? Number(value) : "")}
                  >
                    {[1, 2, 3, 4, 5].map((value) => {
                      const id = `rating-${value}`;
                      const isActive = field.value === value;
                      return (
                        <div key={value} className="relative flex items-center">
                          <RadioGroupItem
                            id={id}
                            value={value.toString()}
                            className="absolute opacity-0"
                          />
                          <Label
                            htmlFor={id}
                            className={cn(
                              "flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
                              isActive
                                ? "border-primary bg-primary/5 text-primary"
                                : "border-border/50 text-muted-foreground hover:border-primary/50"
                            )}
                          >
                            {value}
                            <Star
                              className={cn(
                                "h-4 w-4",
                                isActive ? "text-amber-600" : "text-muted-foreground/60"
                              )}
                              strokeWidth={isActive ? 1.5 : 2}
                              fill={isActive ? "currentColor" : "none"}
                            />
                          </Label>
                        </div>
                      );
                    })}
                  </RadioGroup>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="submitAsAnonymous"
            render={({ field }) => (
              <FormItem className="flex items-center space-x-3 rounded-2xl border border-dashed border-border/50 p-4">
                <FormControl>
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={(checked) => field.onChange(checked === true)}
                  />
                </FormControl>
                <div className="space-y-1">
                  <FormLabel className="text-base">Submit anonymously</FormLabel>
                  <FormDescription>Your message will appear as “Anonymous” to the admin team.</FormDescription>
                </div>
              </FormItem>
            )}
          />

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              By submitting, you allow the ashram team to review and improve guest experiences.
            </p>
            <Button type="submit" className="h-12 rounded-2xl px-6" disabled={isSubmitting}>
              {isSubmitting ? "Sending feedback..." : "Send feedback"}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
