"use client";

import { useMemo } from "react";
import Lightbox, { type Slide } from "yet-another-react-lightbox";
import DownloadPlugin from "yet-another-react-lightbox/plugins/download";
import Counter from "yet-another-react-lightbox/plugins/counter";
import {
  ChevronLeft,
  ChevronRight,
  Download as DownloadIcon,
  X,
} from "lucide-react";

export type GalleryLightboxImage = {
  src: string;
  alt: string;
};

export type GalleryLightboxProps = {
  images: GalleryLightboxImage[];
  index: number;
  onClose: () => void;
  onView: (index: number) => void;
};

type DownloadableSlide = Slide & {
  download?: {
    url: string;
    filename: string;
  };
};

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

export function GalleryLightbox({
  images,
  index,
  onClose,
  onView,
}: GalleryLightboxProps) {
  const slides = useMemo<DownloadableSlide[]>(
    () =>
      images.map((image, imageIndex) => ({
        src: image.src,
        alt: image.alt,
        download: {
          url: image.src,
          filename: buildDownloadName(image.alt, imageIndex, image.src),
        },
      })),
    [images],
  );

  return (
    <Lightbox
      className="ashram-lightbox"
      open
      close={onClose}
      index={index}
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
        iconClose: () => <X className="h-5 w-5" aria-hidden />,
        iconPrev: () => <ChevronLeft className="h-6 w-6" aria-hidden />,
        iconNext: () => <ChevronRight className="h-6 w-6" aria-hidden />,
        iconDownload: () => <DownloadIcon className="h-5 w-5" aria-hidden />,
      }}
      on={{
        view: ({ index: nextIndex }) => onView(nextIndex),
      }}
    />
  );
}
