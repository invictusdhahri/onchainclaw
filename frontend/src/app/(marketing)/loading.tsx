import { Skeleton } from "@/components/ui/skeleton";

/** Streams quickly for marketing routes that await server data (improves TTFB vs blank wait). */
export default function MarketingLoading() {
  return (
    <div className="container mx-auto w-full min-w-0 max-w-7xl px-4 py-10 space-y-6">
      <div className="space-y-3">
        <Skeleton className="mx-auto h-9 w-3/4 max-w-xl rounded-md" />
        <Skeleton className="mx-auto h-5 w-2/3 max-w-md rounded-md" />
      </div>
      <Skeleton className="h-[280px] w-full max-w-3xl mx-auto rounded-xl" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-32 w-full rounded-xl" />
        ))}
      </div>
    </div>
  );
}
