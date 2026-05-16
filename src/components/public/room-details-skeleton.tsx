import { Skeleton } from "@/components/ui/skeleton";

export function RoomDetailsSkeleton() {
  return (
    <div className="min-h-screen">
      <div className="container mx-auto px-4 py-6">
        {/* Header Skeleton */}
        <div className="flex justify-between items-center mb-4">
          <Skeleton className="h-10 w-52 rounded-md" />
          <div className="flex items-center gap-1">
            <Skeleton className="h-8 w-8 rounded-md" />
            <Skeleton className="h-8 w-8 rounded-md" />
          </div>
        </div>

        {/* Image Gallery Skeleton */}
        <div className="mb-8">
          <div className="hidden md:grid md:grid-cols-4 md:grid-rows-2 gap-2 h-[80vh] max-h-[500px]">
            <Skeleton className="md:col-span-2 md:row-span-2 rounded-lg" />
            <Skeleton className="md:col-span-2 rounded-lg" />
            <Skeleton className="md:col-span-2 rounded-lg" />
          </div>
          <div className="md:hidden aspect-video">
            <Skeleton className="w-full h-full rounded-lg" />
          </div>
        </div>

        <div className="grid lg:grid-cols-5 gap-x-12">
          {/* Main Content Skeleton */}
          <div className="lg:col-span-3 space-y-8">
            {/* Room Title & Meta */}
            <div>
              <Skeleton className="h-12 w-60 mb-2" />
              <div className="flex items-center gap-4 mt-2">
                <div className="flex items-center gap-1.5">
                  <Skeleton className="h-4 w-4 rounded" />
                  <Skeleton className="h-4 w-36" />
                </div>
                <div className="flex items-center gap-1.5">
                  <Skeleton className="h-4 w-4 rounded" />
                  <Skeleton className="h-4 w-12" />
                </div>
              </div>
              <div className="flex gap-3 mt-2">
                <Skeleton className="h-4 w-4 rounded" />
                <Skeleton className="h-4 w-36" />
              </div>
            </div>

            {/* Description Skeleton */}
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
            </div>

            {/* Amenities Skeleton */}
            <div className="bg-white rounded-xl p-6 shadow-sm border">
              <Skeleton className="h-8 w-32 mb-6" />
              <div className="space-y-6">
                {/* Essential Amenities */}
                <div>
                  <Skeleton className="h-3 w-24 mb-4" />
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {[...Array(6)].map((_, i) => (
                      <div
                        key={`essential-${i}`}
                        className="flex items-center gap-3"
                      >
                        <Skeleton className="w-10 h-10 rounded-lg" />
                        <Skeleton className="h-4 w-20" />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Comfort Amenities */}
                <div>
                  <Skeleton className="h-3 w-20 mb-4" />
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {[...Array(9)].map((_, i) => (
                      <div
                        key={`comfort-${i}`}
                        className="flex items-center gap-3"
                      >
                        <Skeleton className="w-10 h-10 rounded-lg" />
                        <Skeleton className="h-4 w-24" />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Ashram Rules Skeleton */}
            <div className="bg-white rounded-xl p-6 shadow-sm border">
              <Skeleton className="h-8 w-40 mb-6" />
              <div className="space-y-0">
                {/* Check-in & Check-out */}
                <div className="border-b py-4">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-5 w-5 rounded" />
                    <Skeleton className="h-5 w-40" />
                  </div>
                </div>

                {/* Age & ID Requirements */}
                <div className="border-b py-4">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-5 w-5 rounded" />
                    <Skeleton className="h-5 w-48" />
                  </div>
                </div>

                {/* Parking & Transportation */}
                <div className="border-b py-4">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-5 w-5 rounded" />
                    <Skeleton className="h-5 w-52" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Booking Card Skeleton */}
          <div className="lg:col-span-2 mt-8 lg:mt-0 shadow-lg rounded-xl border border-gray-100">
            <div className="sticky top-32 overflow-hidden rounded-2xl bg-white p-6 text-foreground">
              {/* Price Display Section */}
              <div className="p-6 bg-orange-50 rounded-xl mb-6">
                <Skeleton className="h-3 w-12 mb-1" />
                <Skeleton className="h-9 w-32 mb-1" />
                <Skeleton className="h-3 w-16" />
              </div>

              <div className="space-y-6">
                {/* Date Picker Skeleton */}
                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  <div className="p-4 border-b border-gray-200">
                    <div className="flex items-center gap-3">
                      <Skeleton className="h-5 w-5 rounded" />
                      <div className="flex-1">
                        <Skeleton className="h-3 w-32 mb-1" />
                        <Skeleton className="h-4 w-48" />
                      </div>
                    </div>
                  </div>

                  {/* Guests & Rooms Grid */}
                  <div className="grid grid-cols-2 gap-0 divide-x">
                    {/* Guests Skeleton */}
                    <div className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Skeleton className="h-5 w-5 rounded" />
                          <div>
                            <Skeleton className="h-3 w-12 mb-1" />
                            <Skeleton className="h-4 w-20" />
                          </div>
                        </div>
                        <Skeleton className="h-4 w-4" />
                      </div>
                    </div>

                    {/* Rooms Skeleton */}
                    <div className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Skeleton className="h-5 w-5 rounded" />
                          <div>
                            <Skeleton className="h-3 w-12 mb-1" />
                            <Skeleton className="h-4 w-16" />
                          </div>
                        </div>
                        <Skeleton className="h-4 w-4" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Special Requests Skeleton */}
                <div className="space-y-2">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-20 w-full rounded-xl" />
                </div>

                {/* Pricing Breakdown Skeleton */}
                <div className="space-y-3 p-4 bg-orange-50 rounded-xl">
                  <div className="flex justify-between items-center">
                    <Skeleton className="h-3 w-32" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                  <div className="flex justify-between items-center">
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                  <div className="border-t border-gray-200 pt-3 mt-3">
                    <div className="flex justify-between items-start">
                      <Skeleton className="h-4 w-12" />
                      <div className="text-right space-y-1">
                        <Skeleton className="h-8 w-24" />
                        <Skeleton className="h-3 w-32" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Reserve Button Skeleton */}
                <Skeleton className="h-14 w-full rounded-xl" />

                {/* Disclaimer Text Skeleton */}
                <Skeleton className="h-3 w-3/4 mx-auto" />
              </div>
            </div>
          </div>
        </div>

        {/* Related Rooms Skeleton */}
        <div className="mt-16">
          <Skeleton className="h-8 w-48 mb-8" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className="overflow-hidden rounded-2xl border border-border/50 bg-card text-foreground"
              >
                <Skeleton className="h-48 w-full" />
                <div className="p-4 space-y-2">
                  <Skeleton className="h-6 w-3/4" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-10 w-full mt-4" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
