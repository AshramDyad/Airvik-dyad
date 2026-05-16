import { Skeleton } from "@/components/ui/skeleton";

export function BookingReviewSkeleton() {
  return (
    <div className="container px-4 mx-auto py-10">
      <Skeleton className="h-10 w-64 mx-auto mb-6" />
      
      <div className="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto">
        {/* Summary Cards - Left Side */}
        <div className="space-y-6">
          {/* Property Card */}
          <div className="rounded-2xl border border-border/50 bg-card text-foreground">
            <div className="p-0">
              <Skeleton className="h-52 w-full rounded-t-lg" />
              <div className="p-4 space-y-2">
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
              </div>
            </div>
          </div>

          {/* Booking Details Card */}
          <div className="rounded-2xl border border-border/50 bg-card text-foreground">
            <div className="flex flex-col gap-2 px-6 py-5">
              <Skeleton className="h-6 w-48" />
            </div>
            <div className="px-6 pb-6 pt-0">
              <div className="flex justify-between space-x-4">
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-5 w-20" />
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-4 w-24" />
                </div>
                <div className="w-px bg-border" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-5 w-20" />
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-4 w-24" />
                </div>
              </div>
              <div className="mt-4 space-y-2">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-6 w-24" />
              </div>
            </div>
          </div>

          {/* Price Summary Card */}
          <div className="rounded-2xl border border-border/50 bg-card text-foreground">
            <div className="flex flex-col gap-2 px-6 py-5">
              <Skeleton className="h-6 w-32" />
            </div>
            <div className="px-6 pb-6 pt-0 space-y-4">
              <div className="space-y-2">
                <Skeleton className="h-5 w-24" />
                <div className="flex justify-between">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-16" />
                </div>
                <div className="flex justify-between">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-12" />
                </div>
              </div>
              <div className="border-t pt-4">
                <div className="flex justify-between">
                  <Skeleton className="h-6 w-28" />
                  <Skeleton className="h-6 w-24" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Form - Right Side */}
        <div className="md:col-span-2">
          <div className="rounded-2xl border border-border/50 bg-card text-foreground">
            <div className="flex flex-col gap-2 px-6 py-5">
              <Skeleton className="h-7 w-64" />
            </div>
            <div className="px-6 pb-6 pt-0 space-y-6">
              {/* Guest Details Section */}
              <div className="space-y-4">
                <Skeleton className="h-6 w-32" />
                <div className="grid grid-cols-2 gap-4">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <div className="grid sm:grid-cols-2 gap-4">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              </div>

              {/* Divider */}
              <div className="border-t" />

              {/* Payment Section */}
              <div className="space-y-4">
                <Skeleton className="h-6 w-32" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <div className="grid grid-cols-2 gap-4">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              </div>

              {/* CTA Button */}
              <Skeleton className="h-12 w-full rounded-lg" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
