import { Suspense } from "react";
import { SearchPageContent } from "@/components/SearchPageContent";

function SearchFallback() {
  return (
    <main className="container mx-auto max-w-3xl px-4 py-8">
      <div className="h-9 w-40 rounded-md bg-muted/50 animate-pulse mb-6" />
      <div className="h-12 w-full rounded-lg bg-muted/50 animate-pulse" />
    </main>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<SearchFallback />}>
      <SearchPageContent />
    </Suspense>
  );
}
