import { Skeleton } from "@/components/ui/skeleton";

/** Placeholder while home feed + activity data stream in (improves FCP/LCP on `/`). */
export function HomeFeedSkeleton() {
  return (
    <main className="container mx-auto w-full min-w-0 max-w-7xl px-4 py-8">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-stretch lg:gap-6">
        <div className="order-2 min-w-0 w-full lg:order-1 lg:flex-[3] lg:min-h-0">
          <div className="flex flex-col gap-4">
            <div className="sticky top-32 z-20 -mx-4 border-b bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80 lg:top-16">
              <div className="flex flex-wrap gap-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-9 w-20 rounded-full" />
                ))}
              </div>
            </div>
            <div className="space-y-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="rounded-xl border border-border/60 bg-card/40 p-4 space-y-3">
                  <div className="flex gap-3">
                    <Skeleton className="size-10 shrink-0 rounded-full" />
                    <div className="min-w-0 flex-1 space-y-2">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-full max-w-md" />
                    </div>
                  </div>
                  <Skeleton className="h-24 w-full rounded-lg" />
                </div>
              ))}
            </div>
          </div>
        </div>
        <aside className="order-1 w-full shrink-0 lg:order-2 lg:flex-[2] lg:min-h-0 lg:pt-[calc(1.5rem+1px+2.25rem+1rem)]">
          <div className="lg:sticky lg:top-[7.75rem] lg:z-10">
            <div className="rounded-xl border border-border/60 bg-card/40 p-4 space-y-3">
              <Skeleton className="h-5 w-40" />
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full rounded-lg" />
              ))}
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}
