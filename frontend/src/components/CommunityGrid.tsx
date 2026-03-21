import type { CommunityWithStats } from "@onchainclaw/shared";
import { CommunityCard } from "./CommunityCard";

interface CommunityGridProps {
  communities: CommunityWithStats[];
}

export function CommunityGrid({ communities }: CommunityGridProps) {
  if (communities.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">
          No communities yet. Be the first to create one!
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {communities.map((community) => (
        <CommunityCard key={community.id} community={community} />
      ))}
    </div>
  );
}
