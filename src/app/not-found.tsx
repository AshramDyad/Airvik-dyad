"use client";

import Link from "next/link";
import Image from "@/components/ui/cloudflare-image";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

export default function NotFound() {
  return (
    <section className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 text-foreground">
      <Image
        src="/shajanad.png"
        alt=""
        fill
        priority
        className="object-cover"
      />
      <div className="absolute inset-0 bg-black/20" aria-hidden="true" />
      <motion.div
        className="relative z-10 mx-auto flex w-full max-w-5xl px-4 flex-col items-center gap-12 rounded-3xl bg-background/70 py-5 sm:py-8 backdrop-blur"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      >
        {/* text content */}
        <motion.div
          className="flex flex-col items-center text-center space-y-5"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.5 }}
        >
          <span className="text-sm font-semibold uppercase tracking-[0.32em] text-primary">
            Page Not Found
          </span>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold">
            404 — Lost in Serenity
          </h1>
          <p className="max-w-2xl text-base text-muted-foreground md:text-lg">
            The page you are looking for has taken a different path. Let us
            guide you back to the peaceful spaces of SahajAnand Wellness.
          </p>
        </motion.div>

        <motion.div
          className="flex flex-col items-center gap-4 text-center sm:flex-row sm:gap-6 w-full sm:w-auto"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
        >
          <Button
            asChild
            className="min-w-[230px] w-full bg-primary hover:bg-primary-hover"
          >
            <Link href="/">Return Home</Link>
          </Button>
          <Button
            variant="outline"
            asChild
            className="px-8 w-full border-primary/40 text-primary"
          >
            <Link href="/ashram-glimpse">Explore Ashram Glimpse</Link>
          </Button>
        </motion.div>
      </motion.div>
    </section>
  );
}
