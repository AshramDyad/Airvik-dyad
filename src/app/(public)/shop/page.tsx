import Image from "next/image";

import { ShopCatalogClientLoader } from "./shop-catalog-client-loader";

export default function ShopPage() {
  return (
    <div className="overflow-x-hidden">
      <section className="relative overflow-hidden bg-muted">
        <div className="absolute inset-0">
          <Image
            src="/store.jpg"
            alt="Handpicked pieces for mindful living"
            fill
            priority
            sizes="100vw"
            className="object-cover"
          />
        </div>
        <div className="absolute inset-0 bg-black/45" />
        <div className="relative z-10">
          <div className="container mx-auto flex flex-col items-center gap-4 px-4 py-24 text-center text-white md:px-6 md:py-32">
            <h1 className="max-w-3xl text-4xl font-serif font-semibold md:text-5xl">
              Sacred Essentials
            </h1>
            <p className="max-w-2xl text-base text-white/80 md:text-lg">
              Handmade malas, incense & books - offerings from our ashram to
              your home
            </p>
          </div>
        </div>
      </section>

      <section className="bg-background py-16">
        <ShopCatalogClientLoader />
      </section>
    </div>
  );
}
