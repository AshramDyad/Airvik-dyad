import { Skeleton } from "@/components/ui/skeleton";

type AuthFormSkeletonProps = {
  variant?: "centered" | "split";
  fields?: number;
};

export function AuthFormSkeleton({
  variant = "centered",
  fields = 2,
}: AuthFormSkeletonProps) {
  if (variant === "split") {
    return (
      <div className="grid min-h-screen w-full grid-cols-1 overflow-hidden md:grid-cols-[minmax(0,1fr)_minmax(0,560px)]">
        <div className="hidden bg-muted/40 p-10 md:flex md:items-center md:justify-center">
          <div className="w-full max-w-lg space-y-5">
            <Skeleton className="h-8 w-24 rounded-full" />
            <Skeleton className="h-20 w-full rounded-lg" />
            <Skeleton className="h-5 w-3/4" />
          </div>
        </div>
        <div className="flex items-center justify-center p-6 sm:p-10 md:pr-12">
          <AuthCardSkeleton fields={fields} className="max-w-lg" />
        </div>
      </div>
    );
  }

  return (
    <div className="grid min-h-screen place-items-center bg-muted/30 p-6">
      <AuthCardSkeleton fields={fields} className="max-w-sm" />
    </div>
  );
}

function AuthCardSkeleton({
  fields,
  className,
}: {
  fields: number;
  className: string;
}) {
  return (
    <div
      className={`w-full rounded-2xl border border-border/50 bg-card text-foreground ${className}`}
    >
      <div className="flex flex-col gap-2 px-6 py-5 space-y-3">
        <Skeleton className="h-8 w-44" />
        <Skeleton className="h-5 w-full" />
      </div>
      <div className="px-6 pb-6 pt-0 space-y-5">
        {Array.from({ length: fields }).map((_, index) => (
          <Skeleton key={index} className="h-16 rounded-md" />
        ))}
        <Skeleton className="h-11 rounded-md" />
      </div>
    </div>
  );
}
