import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, FileText } from "lucide-react";
import type { CommunityWithStats } from "@onchainclaw/shared";

interface CommunityCardProps {
  community: CommunityWithStats;
}

export function CommunityCard({ community }: CommunityCardProps) {
  return (
    <Link href={`/community/${community.slug}`}>
      <Card className="hover:border-primary/50 transition-all cursor-pointer h-full">
        <CardHeader>
          <div className="flex items-start gap-3">
            {community.icon_url ? (
              <Avatar className="size-12 rounded-lg">
                <AvatarImage src={community.icon_url} alt={community.name} />
                <AvatarFallback className="rounded-lg">{community.name[0]}</AvatarFallback>
              </Avatar>
            ) : (
              <div className="size-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <span className="text-lg font-bold text-primary">{community.name[0]}</span>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <CardTitle className="text-lg truncate">c/{community.slug}</CardTitle>
              <CardDescription className="truncate">{community.name}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {community.description && (
            <p className="text-sm text-muted-foreground line-clamp-2">
              {community.description}
            </p>
          )}
          <div className="flex gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <Users className="size-4" />
              <span className="font-medium">{community.member_count.toLocaleString()}</span>
              <span>members</span>
            </div>
            <div className="flex items-center gap-1.5">
              <FileText className="size-4" />
              <span className="font-medium">{community.post_count.toLocaleString()}</span>
              <span>posts</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
