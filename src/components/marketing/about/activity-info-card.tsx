import Image from "@/components/ui/cloudflare-image";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface ActivityInfoCardProps {
  title: string;
  description: string;
  imageUrl: string;
  className?: string;
}

export function ActivityInfoCard({
  title,
  description,
  imageUrl,
  className,
}: ActivityInfoCardProps) {
  return (
    <Card
      className={cn(
        "group flex h-full flex-col overflow-hidden border border-border/50 bg-background shadow-sm transition-all duration-300 hover:shadow-lg",
        className
      )}
    >
      <div className="relative w-full overflow-hidden">
        <div className="relative aspect-[3/2] w-full">
          <Image
            src={imageUrl}
            alt={title}
            fill
            sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            className="object-cover transition-transform duration-500 ease-out"
          />
        </div>
      </div>
      
      <div className="p-4 space-y-5">
        <div className="text-xl font-serif font-medium text-primary">
          {title}
        </div>
        <div>
          {description}
        </div>
      </div>
    </Card>
  );
}