import Image from "@/components/ui/cloudflare-image";

type ProductCardProps = {
  imageSrc: string;
  name: string;
  price: string;
  originalPrice?: string;
};

export function ProductCard({
  imageSrc,
  name,
  price,
  originalPrice,
}: ProductCardProps) {
  return (
    <div className="group space-y-3">
      <div className="block overflow-hidden rounded-xl shadow-sm transition-shadow duration-300 hover:shadow-md">
        <Image
          src={imageSrc}
          alt={name}
          width={600}
          height={600}
          className="aspect-square lg:h-64 w-full rounded-xl object-cover transition-transform duration-500 group-hover:scale-[1.02]"
          sizes="(min-width: 1280px) 280px, (min-width: 768px) 33vw, 100vw"
        />
      </div>
      <div className="flex items-start justify-between gap-4">
        <p className="text-base font-medium text-foreground transition-colors duration-200 line-clamp-2">
          {name}
        </p>
        <div className="text-right">
          <span className="block text-base font-semibold text-primary">{price}</span>
          {originalPrice ? (
            <span className="block text-sm text-muted-foreground line-through">
              {originalPrice}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
