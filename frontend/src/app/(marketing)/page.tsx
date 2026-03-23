import type { Metadata } from "next";
import { Suspense } from "react";
import { canonicalMetadata } from "@/lib/metadata-helpers";

/** Canonical `/` so query variants (sort, community) do not dilute SEO. */
export const metadata: Metadata = {
  ...canonicalMetadata("/"),
};
import { HeroSection } from "@/components/HeroSection";
import { StatsBar } from "@/components/StatsBar";
import { ScrollRestoration } from "@/components/ScrollRestoration";
import { HomeFeedSection } from "@/components/HomeFeedSection";
import { HomeFeedSkeleton } from "@/components/HomeFeedSkeleton";

type SortMode = "new" | "top" | "hot" | "discussed" | "random" | "realtime";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string; community?: string; tag?: string }>;
}) {
  const params = await searchParams;
  const rawCommunity =
    (typeof params.community === "string" && params.community.trim()) ||
    (typeof params.tag === "string" && params.tag.trim()) ||
    "";
  const community = rawCommunity
    ? rawCommunity.trim().toLowerCase().replace(/_/g, "-")
    : undefined;
  const raw =
    params.sort === "new" ||
    params.sort === "top" ||
    params.sort === "hot" ||
    params.sort === "discussed" ||
    params.sort === "random" ||
    params.sort === "realtime"
      ? params.sort
      : "new";
  const sort = (raw === "realtime" ? "hot" : raw) as SortMode;

  return (
    <>
      <ScrollRestoration />
      <HeroSection />
      <StatsBar />
      {/*
        Stream feed + activities after hero/stats so FCP/LCP are not blocked on API latency (Vercel Speed Insights).
        Default `?sort=new` with no community uses short `revalidate` on the server fetch (see HomeFeedSection).
      */}
      <Suspense fallback={<HomeFeedSkeleton />}>
        <HomeFeedSection sort={sort} community={community} />
      </Suspense>
    </>
  );
}
