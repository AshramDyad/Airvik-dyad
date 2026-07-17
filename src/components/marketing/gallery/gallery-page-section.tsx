"use client";

import React, {
  useCallback,
  useMemo,
  useRef,
  useState,
} from "react";
import Image from "@/components/ui/cloudflare-image";
import { motion } from "framer-motion";
import Lightbox, { type Slide } from "yet-another-react-lightbox";
import DownloadPlugin from "yet-another-react-lightbox/plugins/download";
import Counter from "yet-another-react-lightbox/plugins/counter";
import {
  ChevronLeft,
  ChevronRight,
  Download as DownloadIcon,
  X,
} from "lucide-react";

type GalleryImage = {
  src: string;
  alt: string;
};

type DownloadableSlide = Slide & {
  download?: {
    url: string;
    filename: string;
  };
};

const galleryImages: GalleryImage[] = [
  {
    src: "/havan.png",
    alt: "Saints performing a havan ceremony at the ashram.",
  },
  {
    src: "/Trayambakeshwar_Temple_VK.jpg",
    alt: "Exterior view of a temple at Sahajanand Wellness.",
  },
  {
    src: "/rishikesh-ahsram.jpeg",
    alt: "Front view of the Sahajanand Wellness ashram building.",
  },
  {
    src: "/ashram-stay.png",
    alt: "A serene pathway within the ashram premises.",
  },
  {
    src: "/gallery-room-05-2-1.png",
    alt: "A clean and simple room for guests at the ashram.",
  },
  {
    src: "/annakshetra.png",
    alt: "The Annakshetra, where meals are served to all.",
  },
  {
    src: "/gausala.webp",
    alt: "Cows being cared for at the ashram's Gaushala.",
  },
  {
    src: "/ved-pathsala.png",
    alt: "Young scholars at the Veda-Pathshala.",
  },
  {
    src: "/ganga-arti.jpg",
    alt: "Evening Ganga Aarti ceremony.",
  },
  {
    src: "/swami.jpeg",
    alt: "Spiritual guide Sunil Bhagat (Swami).",
  },
  {
    src: "/ganga-rishikesh.jpg",
    alt: "A scenic view of the Ganga river in Rishikesh.",
  },
  {
    src: "/about-goshala-2.jpg",
    alt: "A cow at the Gaushala.",
  },
];

const buildDownloadName = (alt: string, index: number, src: string) => {
  const sanitized = alt
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "")
    .trim();
  const fallback = `ashram-image-${index + 1}`;
  const extension = src.split("?")[0]?.split(".").pop() ?? "jpg";
  return `${sanitized || fallback}.${extension}`;
};

export function GalleryPageSection() {
  const [viewerIndex, setViewerIndex] = useState(0);
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const lastTriggerRef = useRef<HTMLButtonElement | null>(null);

  const slides = useMemo<DownloadableSlide[]>(
    () =>
      galleryImages.map((image, index) => ({
        src: image.src,
        alt: image.alt,
        download: {
          url: image.src,
          filename: buildDownloadName(image.alt, index, image.src),
        },
      })),
    []
  );

  const handleClose = useCallback(() => {
    setIsViewerOpen(false);
    setTimeout(() => {
      lastTriggerRef.current?.focus();
    }, 0);
  }, []);

  const openViewer = useCallback(
    (index: number) => (event: React.MouseEvent<HTMLButtonElement>) => {
      lastTriggerRef.current = event.currentTarget;
      setViewerIndex(index);
      setIsViewerOpen(true);
    },
    []
  );

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { scale: 0.9, opacity: 0 },
    visible: {
      scale: 1,
      opacity: 1,
      transition: {
        duration: 0.5,
        ease: "easeOut" as const,
      },
    },
  };

  return (
    <section className="bg-background py-10 sm:py-12">
      <div className="container mx-auto px-4">
        <motion.div
          className="text-center space-y-4"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.6, ease: "easeOut" as const }}
        >
          <h1 className="2xl:text-5xl md:text-4xl text-3xl font-bold text-foreground">
            <span className="block sm:inline">Ashram Moments</span>
            <span className="sm:inline"> of Peace</span>
          </h1>
          <p className="text-base text-muted-foreground md:text-lg max-w-xl mx-auto">
            Experience the serenity, devotion, and beauty of our Ashram through
            these captured moments
          </p>
        </motion.div>
        <motion.div
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6 lg:gap-8 mt-12"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.1 }}
        >
          {galleryImages.map((image, index) => (
            <motion.div
              key={index}
              variants={itemVariants}
              className="shadow-lg transition-shadow duration-150 hover:shadow-xl"
            >
              <button
                type="button"
                onClick={openViewer(index)}
                aria-label={`Open image ${index + 1} of ${galleryImages.length}`}
                className="group block w-full rounded-2xl border border-border/50 overflow-hidden focus-visible:outline-none"
              >
                <div className="relative aspect-[4/3] w-full overflow-hidden">
                  <Image
                    src={image.src}
                    alt={image.alt}
                    fill
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                    className="object-cover transition-transform duration-150 group-hover:scale-110"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors duration-150" />
                </div>
              </button>
            </motion.div>
          ))}
        </motion.div>
      </div>

      <Lightbox
        className="ashram-lightbox"
        open={isViewerOpen}
        close={handleClose}
        index={viewerIndex}
        slides={slides}
        controller={{ closeOnBackdropClick: true }}
        carousel={{ finite: false, imageFit: "contain" }}
        plugins={[DownloadPlugin, Counter]}
        counter={{
          container: {
            className: "ashram-lightbox-counter",
            "aria-live": "polite",
          },
        }}
        toolbar={{
          buttons: ["close", "download"],
        }}
        render={{
          iconClose: () =>  <X className="h-5 w-5" aria-hidden />,
          iconPrev: () => <ChevronLeft className="h-6 w-6" aria-hidden />,
          iconNext: () => <ChevronRight className="h-6 w-6" aria-hidden />,
          iconDownload: () => <DownloadIcon className="h-5 w-5" aria-hidden />,
        }}
        on={{
          view: ({ index }) => setViewerIndex(index),
        }}
      />
    </section>
  );
}
