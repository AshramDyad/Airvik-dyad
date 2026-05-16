"use client";

import dynamic from "next/dynamic";
import { HeartHandshake, MessageSquareHeart } from "lucide-react";

import type { SupportAction } from "@/components/marketing/home/SupportActionsSection";

const EventBannerModal = dynamic(() =>
  import("@/components/marketing/home/EventBannerModal").then(
    (module) => module.EventBannerModal,
  ),
);
const WelcomeSection = dynamic(() =>
  import("@/components/marketing/home/WelcomeSection").then(
    (module) => module.WelcomeSection,
  ),
);
const GallerySection = dynamic(() =>
  import("@/components/marketing/home/GallerySection").then(
    (module) => module.GallerySection,
  ),
);
const VideoSection = dynamic(() =>
  import("@/components/marketing/home/VideoSection").then(
    (module) => module.VideoSection,
  ),
);
const RoomsShowcaseSection = dynamic(() =>
  import("@/components/marketing/home/RoomsShowcaseSection").then(
    (module) => module.RoomsShowcaseSection,
  ),
);
const ReviewSection = dynamic(() =>
  import("@/components/marketing/home/ReviewSection").then(
    (module) => module.ReviewSection,
  ),
);
const SupportActionsSection = dynamic<{ actions: SupportAction[] }>(() =>
  import("@/components/marketing/home/SupportActionsSection").then(
    (module) => module.SupportActionsSection,
  ),
);

const supportActions: SupportAction[] = [
  {
    eyebrow: "FEEDBACK",
    title: "Share your peaceful reflections",
    description:
      "Tell us your gentle thoughts what touched your heart, what felt special, or where we can grow.Your reflections help us serve every seeker with more care and devotion.",
    href: "/feedback",
    ctaLabel: "Go to feedback",
    icon: MessageSquareHeart,
  },
  {
    eyebrow: "DONATE",
    title: "Support daily seva initiatives",
    description:
      "Your contribution helps us continue essential seva daily meals, wellness stays, spiritual gatherings, and ongoing cleanliness of the ashram surroundings.",
    href: "/donate",
    ctaLabel: "Visit donate page",
    icon: HeartHandshake,
  },
];

export function HomeDeferredSections() {
  return (
    <>
      <EventBannerModal />
      <WelcomeSection />
      <GallerySection />
      <VideoSection />
      <RoomsShowcaseSection />
      <ReviewSection />
      <SupportActionsSection actions={supportActions} />
    </>
  );
}
