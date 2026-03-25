"use client";

import React from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Mail,
  Phone,
  MapPin,
  Facebook,
  Instagram,
  Linkedin,
  Youtube,
} from "lucide-react";
import { FaXTwitter } from "react-icons/fa6";
import { BsThreads } from "react-icons/bs";
import type { Property } from "@/data/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { label } from "yet-another-react-lightbox";

const quickLinks = [
  { href: "/book", label: "Rooms" },
  { href: "/about-us", label: "About Us" },
  { href: "/shop", label: "Shop" },
  { href: "/amenities", label: "Amenities" },
  { href: "/ashram-glimpse", label: "Ashram Glimpse" },
  /* borche add */
  { href: "/brochure" , label : "Brochure"}
];

const AshramLinks = [
  { href: "/journey", label: "Our Journey" },
  { href: "/feedback", label: "Feedback" },
  { href: "/donate", label: "Donate" },
  { href: "/blog", label: "News" },
  { href: "/events", label: "Events" },
];

type SocialLink = {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
};

const socialLinks: SocialLink[] = [
  { href: "https://facebook.com/Rishikeshdhamofficial", icon: Facebook },
  { href: "https://instagram.com/rishikeshdhamofficial", icon: Instagram },
  { href: "https://www.youtube.com/@rishikeshdham", icon: Youtube },
  { href: "https://x.com/Rishikeshdham", icon: FaXTwitter },
  { href: "https://www.threads.net/@rishikeshdhamofficial", icon: BsThreads },
  { href: "https://linkedin.com/company/rishikeshdham", icon: Linkedin },
];

/**
 * Site footer containing logo, contact information, quick navigation links, and social icons.
 *
 * Renders a branded footer with the organization logo and subtitle, contact methods (email, phone, address),
 * a list of quick links, and social media links.
 *
 * @returns The footer React element
 */
type FooterProps = {
  propertyLocation: Pick<Property, "address" | "google_maps_url">;
};

export function Footer({ propertyLocation }: FooterProps) {
  const [isLocationDialogOpen, setIsLocationDialogOpen] = React.useState(false);
  const locationSrc = propertyLocation.google_maps_url?.trim() ?? "";
  const addressText =
    propertyLocation.address?.trim() || "Location details are not available.";
  const hasLocationMap = locationSrc.length > 0;

  return (
    <>
      <footer className="border-t shadow-md">
        <div className="container mx-auto px-4 pt-16 pb-5">
          {/* First Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 mb-5 gap-10">
            {/* Column 1: Logo and Subtitle */}
            <div>
              <Link
                href="/"
                className="flex items-center shrink-0 focus-visible:outline-none"
              >
                {/* Header-logo */}
                <Image
                  src="/logo.png"
                  alt="SahajAnand Wellness Logo"
                  width={360}
                  height={160}
                  quality={100}
                  priority
                  sizes="(max-width: 640px) 128px, (max-width: 1024px) 176px, (max-width: 1280px) 208px, 240px"
                  className="h-auto w-52 xl:w-56 max-w-full"
                />
              </Link>
              <p className="text-muted-foreground max-w-md mt-3">
                A registered religious trust in Uttarakhand, dedicated to
                religious, educational, and health-related activities.
              </p>
              <div className="flex items-center space-x-2 mt-6">
                {socialLinks.map((link, index) => (
                  <a
                    key={index}
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-primary bg-card lg:size-10 size-8 rounded-full flex items-center flex-shrink-0 justify-center transition-colors focus-visible:outline-none"
                  >
                    <link.icon className="lg:size-5 size-4" />
                  </a>
                ))}
              </div>
            </div>

            {/* Column 2: Contact Details */}
            <div className="min-w-0">
              <h3 className="text-xl font-bold text-foreground mb-6">
                Contact Us
              </h3>
              <div className="space-y-3 text-muted-foreground">
                <a
                  href="mailto:ashram@swaminarayan.yoga"
                  className="flex min-w-0 items-start gap-3 hover:text-primary transition-colors focus-visible:outline-none"
                >
                  <Mail className="h-5 w-5 text-primary flex-shrink-0" />
                  <span className="w-full break-all">
                    ashram@swaminarayan.yoga
                  </span>
                </a>
                <a
                  href="tel:+918511151708"
                  className="flex min-w-0 items-start gap-3 hover:text-primary transition-colors focus-visible:outline-none"
                >
                  <Phone className="h-5 w-5 text-primary flex-shrink-0" />
                  <span className="w-full break-all">+91 8511151708</span>
                </a>

                <a
                  href="tel:+918595251312"
                  className="flex min-w-0 items-start gap-3 hover:text-primary transition-colors focus-visible:outline-none"
                >
                  <div className="h-5 w-5 flex-shrink-0" />
                  <span className="w-full break-all">+91 8595251312</span>
                </a>

                <a
                  href="tel:+919319825050"
                  className="flex min-w-0 items-start gap-3 hover:text-primary transition-colors focus-visible:outline-none"
                >
                  <div className="h-5 w-5 flex-shrink-0" />
                  <span className="w-full break-all">+91 9319825050</span>
                </a>
                {hasLocationMap ? (
                  <button
                    type="button"
                    aria-label="Open property location map"
                    onClick={() => setIsLocationDialogOpen(true)}
                    className="flex min-w-0 items-start gap-3 text-left hover:text-primary transition-colors focus-visible:outline-none"
                  >
                    <MapPin className="h-5 w-5 text-primary mt-1 flex-shrink-0" />
                    <span className="w-full break-words">{addressText}</span>
                  </button>
                ) : (
                  <div className="flex min-w-0 items-start gap-3">
                    <MapPin className="h-5 w-5 text-primary mt-1 flex-shrink-0" />
                    <span className="w-full break-words">{addressText}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Column 3: Links */}
            <div>
              <h3 className="text-xl font-bold text-foreground mb-6">
                Quick Links
              </h3>
              <ul className="space-y-3">
                {quickLinks.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-muted-foreground hover:text-primary transition-colors focus-visible:outline-none"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            {/* Column 3: Links */}
            <div>
              <h3 className="text-xl font-bold text-foreground mb-6">
                Ashram Links
              </h3>
              <ul className="space-y-3">
                {AshramLinks.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-muted-foreground hover:text-primary transition-colors focus-visible:outline-none"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            {/* Column 4: QR Code */}
            <div>
              <div className="flex flex-col lg:items-end">
                <div className="w-3/5">
                  <h3 className="text-xl font-bold text-foreground mb-6 inline-block">
                    Scan to Explore
                  </h3>
                  <Image
                    src="/qr-code-for-website.jpg"
                    alt="Rishikesh Dham QR code"
                    width={280}
                    height={300}
                    quality={100}
                    className="w-full rounded-lg object-contain"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Separator */}
          <div className="border-t border-border/50 pb-5"></div>

          {/* Second Row */}
          <div className="flex items-center justify-center">
            <Link
              href="https://apexture.in/"
              className="text-muted-foreground mb-4 sm:mb-0 sm:text-lg text-base"
            >
              Managed by{" "}
              <Image
                className="inline-block align-middle mx-1"
                alt="logo"
                src="apexture-logo.svg"
                width={120}
                height={40}
                quality={100}
              ></Image>
            </Link>
          </div>
        </div>
      </footer>
      {hasLocationMap ? (
        <Dialog
          open={isLocationDialogOpen}
          onOpenChange={setIsLocationDialogOpen}
        >
          <DialogContent className="max-w-[95vw] overflow-hidden p-0 md:max-w-4xl">
            <DialogHeader className="border-b border-border/40 px-6 py-5">
              <DialogTitle>Property Location</DialogTitle>
              <DialogDescription>{addressText}</DialogDescription>
            </DialogHeader>
            <div className="aspect-video w-full">
              <iframe
                src={locationSrc}
                width="100%"
                height="100%"
                style={{ border: 0 }}
                allowFullScreen={false}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                title="Property location map"
              ></iframe>
            </div>
          </DialogContent>
        </Dialog>
      ) : null}
    </>
  );
}
