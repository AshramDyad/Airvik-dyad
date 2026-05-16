"use client";

import Image from "next/image";
import Link from "next/link";
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useIsMobileOrTablet } from "@/hooks/useIsMobileOrTablet";

interface ActivityCardProps {
  title: string;
  description: string;
  imageUrl: string;
  href: string;
}

/**
 * Renders an interactive activity card with a background image, title, description, and a VIEW link.
 *
 * The card reveals the description and the VIEW button on hover for desktop devices, and on toggle via the action button for mobile/tablet devices.
 *
 * @param title - The card title displayed prominently
 * @param description - The descriptive text revealed when the card is expanded
 * @param imageUrl - Background image URL used to fill the card
 * @param href - Destination URL used by the VIEW link
 * @returns The JSX element for the activity card
 */
export function ActivityCard({
  title,
  description,
  imageUrl,
  href,
}: ActivityCardProps) {
  const isMobileOrTablet = useIsMobileOrTablet();
  const [isHovered, setIsHovered] = useState(false);
  const [isClicked, setIsClicked] = useState(false);

  // On desktop, expansion is controlled by hover.
  // On mobile or tablet, expansion is controlled by click.
  const isExpanded = isMobileOrTablet ? isClicked : isHovered;

  const handleToggleClick = () => {
    if (isMobileOrTablet) {
      setIsClicked((prev) => !prev);
    }
  };

  const containerProps = isMobileOrTablet
    ? {}
    : {
        onMouseEnter: () => setIsHovered(true),
        onMouseLeave: () => setIsHovered(false),
      };

  return (
    <div
      className="group relative h-[400px] overflow-hidden rounded-2xl text-white"
      {...containerProps}
    >
      {/* Background Image */}
      <Image
        src={imageUrl}
        alt={title}
        fill
        className={cn(
          "object-cover transition-transform duration-500 ease-in-out",
          isExpanded && "scale-110"
        )}
        sizes="(max-width: 768px) 100vw, 33vw"
      />

      {/* Content Overlay */}
      <div className="absolute inset-0 flex flex-col justify-between bg-gradient-to-t from-black/70 via-black/40 to-transparent p-6 transition-all duration-300">
        {/* View Button (visible on expand) */}
        <div className="flex justify-end">
          <Button
            asChild
            className={cn(
              "translate-y-[-20px] transform opacity-0 hover:bg-primary-hover transition-all duration-300",
              isExpanded && "translate-y-0 opacity-100"
            )}
          >
            <Link href={href}>VIEW</Link>
          </Button>
        </div>

        {/* Text Content */}
        <div
          className={cn(
            "transform transition-transform duration-500 ease-in-out",
            isExpanded && "-translate-y-4"
          )}
        >
          <div className="flex items-center justify-between gap-4">
            <h3 className="text-2xl font-serif font-bold">{title}</h3>
            {isMobileOrTablet && (
              <Button
                size="icon"
                variant="ghost"
                onClick={handleToggleClick}
                className="flex-shrink-0 rounded-full hover:bg-white/20 hover:text-white text-white"
                aria-expanded={isExpanded}
                aria-label={isExpanded ? "Collapse" : "Expand"}
              >
                {isExpanded ? (
                  <Minus className="h-6 w-6" />
                ) : (
                  <Plus className="h-6 w-6" />
                )}
              </Button>
            )}
          </div>
          <p
            className={cn(
              "mt-2 max-h-0 text-base text-primary-foreground/80 opacity-0 transition-all duration-500 ease-in-out",
              isExpanded && "max-h-40 opacity-100"
            )}
          >
            {description}
          </p>
        </div>
      </div>
    </div>
  );
}
