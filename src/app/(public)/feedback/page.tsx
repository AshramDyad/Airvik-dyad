import type { Metadata } from "next";
import { FeedbackFormLoader } from "@/components/feedback/feedback-form-loader";

export const metadata: Metadata = {
  title: "Share Feedback | Sahajanand Wellness",
  description:
    "Send suggestions, praise, complaints, or questions to the Swaminarayan Ashram team.",
};

export default function FeedbackPage() {
  return (
    <section className="bg-muted/20 py-16 sm:py-24">
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-3xl text-center space-y-4">
          <p className="text-sm font-semibold uppercase tracking-widest text-primary">Feedback</p>
          <h1 className="text-4xl font-serif font-semibold text-foreground sm:text-5xl">
            Help us nurture better stays and experiences
          </h1>
          <p className="text-lg text-muted-foreground">
            Whether you have a suggestion, a kind word, or noticed something we should improve,
            your voice guides how we serve every guest.
          </p>
        </div>
        <div className="mt-12">
          <FeedbackFormLoader />
        </div>
      </div>
    </section>
  );
}
