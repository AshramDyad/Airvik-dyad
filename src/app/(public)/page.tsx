"use client";

import Image from "next/image";
import { motion, type Variants } from "framer-motion";
import { MessageSquareHeart, HeartHandshake } from "lucide-react";
import { FeatureCard } from "@/components/marketing/home/FeatureCard";
import { WelcomeSection } from "@/components/marketing/home/WelcomeSection";
import { VideoSection } from "@/components/marketing/home/VideoSection";
import { RoomsShowcaseSection } from "@/components/marketing/home/RoomsShowcaseSection";
import { ReviewSection } from "@/components/marketing/home/ReviewSection";
import { GallerySection } from "@/components/marketing/home/GallerySection";
import { SupportActionsSection, type SupportAction } from "@/components/marketing/home/SupportActionsSection";
import { Marquee } from "@/components/marketing/layout/Marquee";
import { EventBannerModal } from "@/components/marketing/home/EventBannerModal";

type Feature = {
  title: string;
  description: string;
  imageUrl: string;
  highlighted: boolean;
  href?: string;
  desktopPositionClass: string;
};

const features: Feature[] = [
  {
    title: "Ashram Stay",
    description:
      "Peaceful and comfortable ashram rooms for meditation, reflection, and spiritual retreat",
    imageUrl: "/ashram-stays.png",
    highlighted: true,
    href: "/booking",
    desktopPositionClass: "lg:col-start-2 lg:row-start-1",
  },
  {
    title: "Annakshetra",
    description:
      "Wholesome meals for all, serving visitors and the local community with love in Rishikesh.",
    imageUrl: "/annakshetra.png",
    highlighted: false,
    desktopPositionClass: "lg:col-start-1 lg:row-start-1",
  },
  {
    title: "Yoga & Meditation",
    description:
      "Daily yoga and guided meditation to harmonize your mind, body, and soul in serene Rishikesh.",
    imageUrl: "/yoga-ashram.png",
    highlighted: false,
    desktopPositionClass: "lg:col-start-3 lg:row-start-1",
  },
];

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

/**
 * Root page component that renders the Sahajanand Wellness home page layout.
 *
 * Renders the hero banner with background image and animated title, a features grid
 * with staggered entrance animations, and the site sections: Welcome, Gallery,
 * Video, Stay, Review, and Marquee.
 *
 * @returns The JSX element representing the complete home page.
 */
export default function HomePage() {
  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.2,
      },
    },
  };

  const itemVariants: Variants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: {
        duration: 0.6,
        ease: [0.16, 1, 0.3, 1],
      },
    },
  };

  const newLocal = "relative mb-10 md:mb-20";
  return (
    <div className="bg-background text-foreground">
      <EventBannerModal />
      {/* Hero Section */}
      <section className="relative w-full h-[70vh] min-h-[500px]">
        <Image
          src="/home-img.png"
          alt="Rishikesh temple by the Ganges"
          fill
          style={{ objectFit: "cover" }}
          quality={100}
          priority
        />
        <div className="absolute inset-0 bg-black/40" />
        <div className="relative z-10 flex flex-col items-center justify-center h-full text-center text-white">
          <motion.div
            className="max-w-4xl px-4"
            initial="hidden" 
            animate="visible"
            variants={containerVariants}
          >
            <motion.div
              variants={itemVariants}
              className="flex justify-center"
            >
              <Image
                src="/Swami-narayan.png"
                alt="Sahajanand Wellness"
                width={400}
                height={400}
                quality={100}
                className="size-32 sm:size-52 object-contain"
              />
            </motion.div>
            <motion.p
              variants={itemVariants}
              className="text-sm sm:text-md font-semibold tracking-widest text-primary-foreground/80 mb-2 sm:mb-4 uppercase"
            >
              Welcome To
            </motion.p>
            <motion.h1
              variants={itemVariants}
              className="text-4xl sm:text-5xl lg:text-7xl font-bold font-serif leading-tight"
            >
              Sahajanand Wellness
            </motion.h1>
            <motion.p
              variants={itemVariants}
              className="mt-3 text-base sm:text-lg font-medium tracking-wider text-primary-foreground/90 uppercase"
            >
              Affordable Ashram Stay on the Banks of the Ganges, Rishikesh
            </motion.p>
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section className={newLocal}>
        <div className="container mx-auto px-4 -mt-16">
          <motion.div
            className="grid grid-cols-1 lg:grid-cols-3 xl:gap-8 gap-6 items-center"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.2 }}
            variants={containerVariants}
          >
            {features.map((feature) => (
              <motion.div
                key={feature.title}
                variants={itemVariants}
                className={feature.desktopPositionClass}
              >
                <FeatureCard
                  title={feature.title}
                  description={feature.description}
                  imageUrl={feature.imageUrl}
                  highlighted={feature.highlighted}
                  href={feature.href}
                  className={`h-full ${
                    feature.highlighted ? "" : "lg:h-[400px]"
                  }`}
                />
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Welcome Section */}

      <WelcomeSection />

      {/* Gallery Section */}
      <GallerySection />

      {/* Video Section */}
      <VideoSection />
      <RoomsShowcaseSection />

      {/* Review Section */}
      <ReviewSection />

      {/* Support Actions Section */}
      <SupportActionsSection actions={supportActions} />


      <Marquee />
    </div>
  );
}
