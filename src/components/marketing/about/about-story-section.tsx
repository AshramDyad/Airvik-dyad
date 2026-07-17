"use client";

import Image from "@/components/ui/cloudflare-image";
import Link from "next/link";
import { motion } from "framer-motion";

export function AboutStorySection() {
  return (
    <section id="our-story" className="bg-background py-10 sm:py-12 overflow-hidden">
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-6xl">
          <motion.div
            className="text-center space-y-4"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          >
            <span className="text-sm font-semibold uppercase tracking-widest text-primary">
              Our Heritage
            </span>
            <h2 className="2xl:text-5xl md:text-4xl text-3xl font-bold text-foreground">
              Our Sacred Story
            </h2>
            <p className="text-base text-muted-foreground md:text-lg">
              A peaceful ashram by the Ganges, guided by compassion and service.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 gap-10 md:gap-12 lg:grid-cols-2 lg:items-center mt-4 lg:mt-12">
            <motion.div
              className="order-2 lg:order-1"
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            >
              <figure className="flex flex-col space-y-4">
                <div className="relative rounded-xl overflow-hidden">
                  <Image
                    src="/sunil-bhagat.jpeg"
                    alt="Sunil Bhagat (Swamiji), spiritual guide of Sahajanand Wellness"
                    width={600}
                    height={400}
                    className="object-cover rounded-2xl w-full"
                  />
                </div>
                <figcaption className="text-sm text-muted-foreground">
                  Swamiji Sunil Bhagat welcoming visitors in the ashram courtyard.
                </figcaption>
              </figure>
            </motion.div>


            {/* Right Side */}
            <motion.div
              className="order-1 flex h-full flex-col space-y-4 text-center text-lg text-muted-foreground lg:order-2 lg:text-left"
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            >
              <div className="space-y-4 text-base leading-relaxed md:text-lg">
                <p>
                  Nestled on the banks of the Ganga in Rishikesh,
                  <span className="mx-1 font-semibold text-foreground">
                    Shree Swaminarayan Ashram
                  </span>
                  has welcomed seekers since 1987. Founded by the SahajAnand Wellness Trust, the ashram follows the simple principle of welfare for all.
                </p>

                <p>
                  Leading our spiritual life is
                  <span className="mx-1 font-semibold text-foreground">
                    Swamiji Sunil Bhagat.
                  </span>
                  His kind guidance and teachings gently inspire visitors and residents alike.
                </p>

                <p>
                  Our daily work includes the Annakshetra (free meals), the Gaushala (care for cows), and the Veda-Pathshala (Vedic teaching). You&apos;re welcome to visit and feel the calm and warmth of the ashram.
                </p>
              </div>

              <div>
                <Link
                  href="/sunil-bhagat"
                  className="text-base font-medium text-primary hover:underline underline-offset-4 focus-visible:outline-none"
                >
                  Meet Our Guide →
                </Link>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}

