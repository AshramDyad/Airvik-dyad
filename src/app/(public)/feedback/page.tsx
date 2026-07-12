import type { Metadata } from "next";
import { FeedbackForm } from "@/components/feedback/feedback-form";
import { buildMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = buildMetadata({
  title: "Share Feedback",
  description:
    "Send suggestions, praise, or questions to the Sahajanand Wellness (Swaminarayan Ashram) team in Rishikesh. We value your feedback to improve every guest's stay.",
  path: "/feedback",
});

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
          <FeedbackForm />
        </div>
      </div>
    </section>
  );
}
