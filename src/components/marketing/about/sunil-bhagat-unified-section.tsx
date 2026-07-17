"use client";

import Image from "@/components/ui/cloudflare-image";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useRef, useEffect } from "react";

const tabs = [
  {
    id: "life",
    label: "Life",
    title: "Swamiji's Life",
    image: "/about-img.png",
    content: (
      <>
        <p>
          Guiding the ashram&apos;s spiritual journey is{" "}
          <span className="font-semibold text-foreground">Sunil Bhagatji</span>, 
          affectionately known as Swamiji. His profound wisdom and compassionate 
          teachings inspire all who visit, making the ashram a beacon of peace 
          and service.
        </p>
        <p>
          Swamiji&apos;s journey is one of deep devotion, dedicated to sharing 
          timeless wisdom. He emphasizes love, compassion, and a balanced life, 
          helping seekers find inner peace and connect with their true selves.
        </p>
      </>
    ),
    tags: ["Wisdom", "Compassion", "Devotion"],
  },
  {
    id: "work",
    label: "Work",
    title: "Swamiji's Work",
    image: "/annakshetra.png",
    content: (
      <>
        <p>
          Swamiji&apos;s work extends far beyond spiritual discourses, embodying 
          the principle of &apos;welfare for all&apos; in every action. He is the 
          guiding force behind the ashram&apos;s extensive charitable activities.
        </p>
        <div className="grid sm:grid-cols-2 gap-4 my-6">
          <div className="bg-muted/50 border border-border rounded-xl p-4">
            <h4 className="font-semibold text-foreground mb-2">Annakshetra</h4>
            <p className="text-sm text-muted-foreground">
              Provides thousands of free meals daily to pilgrims and those in need.
            </p>
          </div>
          <div className="bg-muted/50 border border-border rounded-xl p-4">
            <h4 className="font-semibold text-foreground mb-2">Gaushala</h4>
            <p className="text-sm text-muted-foreground">
              A sanctuary where sacred cows are honored and protected.
            </p>
          </div>
        </div>
        <p>
          Through his tireless efforts, Swamiji has cultivated a profound environment 
          of selfless service (seva), inspiring all to participate in the ashram&apos;s mission.
        </p>
      </>
    ),
  },
  {
    id: "message",
    label: "Message",
    title: "Swamiji's Message",
    image: "/Message-img.png",
    content: (
      <>
        <p>
          Live with a steady purpose and let selfless service (karma yoga) be your 
          daily practice: be kind, work diligently, follow dharma, and help others 
          without expectation; small acts of giving, honest effort, and joining in 
          satsang, aarti, or community service will purify the heart, strengthen the 
          mind, and bring true, lasting happiness; remain humble, persistent, and 
          disciplined, and let your actions be your prayer.
        </p>
      </>
    ),
    tags: ["Dharma", "Compassion", "Seva", "Peace"],
  },
];

export function SunilBhagatUnifiedSection() {
  const [activeTab, setActiveTab] = useState("life");
  const currentTab = tabs.find((tab) => tab.id === activeTab) || tabs[0];
  const tabRefs = useRef<{ [key: string]: HTMLButtonElement | null }>({});

  useEffect(() => {
    // Scroll active tab into view when it changes
    if (tabRefs.current[activeTab]) {
      tabRefs.current[activeTab]?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "center",
      });
    }
  }, [activeTab]);

  return (
    <section className="bg-background py-10 sm:py-12 overflow-hidden">
      <div className="container mx-auto px-4">
        {/* Section Header */}
        <motion.div
          className="text-center space-y-4"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
          {/* Eyebrow */}
          <p className="text-sm font-semibold uppercase tracking-widest text-primary">
            About Swamiji
          </p>
          <h1 className="2xl:text-5xl md:text-4xl text-3xl font-bold text-foreground">
            <span className="block sm:inline">Swamiji Sunil Bhagat</span>
            <span className="sm:inline"> - Life & Service</span>
          </h1>
          <p className="text-base text-muted-foreground md:text-lg max-w-4xl mx-auto">
            Explore Swamiji Sunil Bhagat&apos;s journey and leadership, his humanitarian initiatives, daily teachings, and practical guidance in seva, dharma and community life that shape SahajAnand Wellness.
          </p>
        </motion.div>

        <div className="max-w-7xl mx-auto mt-12">
          {/* Modern Tab Navigation - Segmented Control */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="mb-8 flex justify-center"
          >
            <div className="overflow-x-auto scrollbar-hide flex bg-muted p-1.5 rounded-full w-full sm:w-[480px]">
              {tabs.map((tab) => {
                const isActive = activeTab === tab.id;
                
                return (
                  <button
                    key={tab.id}
                    ref={(el) => {
                      tabRefs.current[tab.id] = el;
                    }}
                    onClick={() => setActiveTab(tab.id)}
                    className={`
                      relative px-6 sm:px-8 py-3 sm:py-4 rounded-full flex-1
                      font-semibold text-sm sm:text-base whitespace-nowrap
                      transition-colors duration-200 focus:outline-none
                      ${isActive ? "text-white" : "text-muted-foreground hover:text-foreground"}
                    `}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="segmentBg"
                        className="absolute inset-0 bg-primary rounded-full shadow-lg"
                        transition={{ type: "spring", bounce: 0.15, duration: 0.5 }}
                      />
                    )}
                    <span className="relative z-10 flex items-center justify-center">
                      {tab.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </motion.div>
          {/* Dynamic Tab Content - Redesigned */}
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="relative"
          >
            <AnimatePresence mode="wait">
              <div
                key={activeTab}
                className="relative"
              >
              {/* Main Content Card */}
              <div className="bg-card border border-border rounded-3xl overflow-hidden shadow-lg">
                <div className="grid grid-cols-1 lg:grid-cols-5 gap-0">
                  {/* Image Side with Overlay */}
                  <div className="relative h-[350px] sm:h-[450px] lg:h-auto lg:col-span-2 overflow-hidden group">
                    <motion.div
                      key={`image-${activeTab}`}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.5, ease: "easeOut" }}
                      className="relative h-full"
                    >
                      <Image
                        src={currentTab.image}
                        alt={currentTab.title}
                        fill
                        className="object-cover"
                        sizes="(max-width: 1024px) 100vw, 40vw"
                      />
                    </motion.div>
                  </div>

                  {/* Content Side */}
                  <div className="lg:col-span-3 p-4 sm:p-6 lg:p-8 flex flex-col justify-center">
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.6, delay: 0.2 }}
                      className="space-y-4"
                    >
                      {/* Title Section */}
                      <div>
                        <h3 className="text-2xl lg:text-3xl font-serif font-bold text-foreground">
                          {currentTab.title}
                        </h3>
                      </div>

                      {/* Content */}
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.6, delay: 0.4 }}
                        className="space-y-4 text-base sm:text-lg text-muted-foreground"
                      >
                        {currentTab.content}
                      </motion.div>

                      {/* Tags */}
                      {currentTab.tags && (
                        <motion.div
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.6, delay: 0.5 }}
                          className="flex flex-wrap gap-3"
                        >
                          {currentTab.tags.map((tag, index) => (
                            <div
                              key={tag}
                              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-background border border-primary/20 shadow-sm hover:shadow-md hover:border-primary/40 transition-all duration-300 group"
                            >
                              <span className="w-1.5 h-1.5 rounded-full bg-primary group-hover:scale-125 transition-transform duration-300" />
                              <span className="text-sm font-medium text-foreground/80 group-hover:text-foreground transition-colors">
                                {tag}
                              </span>
                            </div>
                          ))}
                        </motion.div>
                      )}
                    </motion.div>
                  </div>
                </div>
              </div>
              </div>
            </AnimatePresence>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
