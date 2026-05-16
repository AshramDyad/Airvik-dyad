"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { X } from "lucide-react";

import * as DialogPrimitive from "@radix-ui/react-dialog";

import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
} from "@/components/ui/dialog";

type HomepageModalBanner = {
  title: string;
  description?: string;
  imageUrl: string;
};

type BannerResponse = { data: HomepageModalBanner | null };

export function EventBannerModal() {
  const [banner, setBanner] = useState<HomepageModalBanner | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const STORAGE_KEY = "eventBannerShown";
    let cancelled = false;
    let timeoutId: number | null = null;
    let loadListenerAdded = false;
    let loadHandler: (() => void) | null = null;

    const markAsShown = () => {
      try {
        window.sessionStorage.setItem(STORAGE_KEY, "1");
      } catch (error) {
        console.error("Failed to persist event banner state", error);
      }
    };

    const fetchBanner = async () => {
      if (cancelled) return;
      if (window.sessionStorage.getItem(STORAGE_KEY)) return;

      try {
        const response = await fetch("/api/event-banner/active");
        if (!response.ok) return;
        const json: BannerResponse = await response.json();
        if (!cancelled && json?.data) {
          setBanner(json.data);
          setOpen(true);
          markAsShown();
        }
      } catch (error) {
        console.error("Failed to fetch event banner", error);
      }
    };

    const startTimer = () => {
      if (cancelled) return;
      if (window.sessionStorage.getItem(STORAGE_KEY)) return;
      timeoutId = window.setTimeout(() => {
        void fetchBanner();
      }, 5000);
    };

    if (document.readyState === "complete") {
      startTimer();
    } else {
      loadHandler = () => {
        startTimer();
      };
      window.addEventListener("load", loadHandler, { once: true });
      loadListenerAdded = true;
    }

    return () => {
      cancelled = true;
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
      if (loadListenerAdded && loadHandler) {
        window.removeEventListener("load", loadHandler);
      }
    };
  }, []);

  if (!banner) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogPortal>
        <DialogOverlay className="bg-black/40 backdrop-blur-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content className="fixed left-1/2 top-1/2 z-50 grid w-full max-w-3xl translate-x-[-50%] translate-y-[-50%] overflow-hidden rounded-3xl border-2 border-primary/70 bg-background p-0 text-foreground shadow-2xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95">
          <div className="relative">
            <Image
              src={banner.imageUrl}
              alt={banner.title}
              width={1200}
              height={700}
              className="lg:h-72 h-48 w-full object-cover"
            />
          </div>
          <div className="space-y-3 px-4 pb-4 pt-4">
            <DialogHeader>
              <DialogTitle className="md:text-2xl text-lg font-semibold leading-tight text-primary">
                {banner.title}
              </DialogTitle>
              {banner.description && (
                <DialogDescription className="text-sm md:text-lg text-muted-foreground">
                  {banner.description}
                </DialogDescription>
              )}
            </DialogHeader>
          </div>
          <DialogClose className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-border/40 bg-card/80 text-primary shadow-sm hover:text-primary-hover focus-visible:outline-none focus-visible:ring-0">
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </DialogClose>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}
